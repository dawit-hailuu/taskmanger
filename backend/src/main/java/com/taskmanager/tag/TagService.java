package com.taskmanager.tag;

import com.taskmanager.exception.ConflictException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.tag.dto.CreateTagRequest;
import com.taskmanager.tag.dto.TagResponse;
import com.taskmanager.user.User;
import com.taskmanager.workspace.Workspace;
import com.taskmanager.workspace.WorkspaceMember;
import com.taskmanager.workspace.WorkspaceRole;
import com.taskmanager.workspace.WorkspaceService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class TagService {

    private final TagRepository tagRepository;
    private final WorkspaceService workspaceService;

    public TagService(TagRepository tagRepository, WorkspaceService workspaceService) {
        this.tagRepository = tagRepository;
        this.workspaceService = workspaceService;
    }

    @Transactional
    public TagResponse create(User user, Long workspaceId, CreateTagRequest request) {
        Workspace workspace = workspaceService.getWorkspaceOrThrow(workspaceId);
        workspaceService.requireMembership(workspace, user);

        if (tagRepository.existsByWorkspaceAndNameIgnoreCase(workspace, request.name())) {
            throw new ConflictException("A tag named \"" + request.name() + "\" already exists in this workspace.");
        }

        Tag tag = new Tag();
        tag.setWorkspace(workspace);
        tag.setName(request.name());
        tag.setColor(request.color());
        tag.setCreatedBy(user);
        tag.setCreatedAt(Instant.now());

        return TagResponse.from(tagRepository.save(tag));
    }

    @Transactional(readOnly = true)
    public List<TagResponse> listForWorkspace(User user, Long workspaceId) {
        Workspace workspace = workspaceService.getWorkspaceOrThrow(workspaceId);
        workspaceService.requireMembership(workspace, user);
        return tagRepository.findByWorkspaceOrderByNameAsc(workspace).stream()
                .map(TagResponse::from)
                .toList();
    }

    @Transactional
    public void delete(User user, Long tagId) {
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found with id " + tagId));

        WorkspaceMember membership = workspaceService.requireMembership(tag.getWorkspace(), user);
        boolean isCreator = tag.getCreatedBy().getId().equals(user.getId());
        boolean isWorkspaceManager = membership.getRole() == WorkspaceRole.ADMIN
                || membership.getRole() == WorkspaceRole.OWNER;

        if (!isCreator && !isWorkspaceManager) {
            throw new AccessDeniedException("You do not have permission to delete this tag.");
        }
        tagRepository.delete(tag);
    }

    /** Fetches a tag, ensuring it belongs to the given workspace (used when attaching to a task). */
    @Transactional(readOnly = true)
    public Tag getInWorkspace(Long tagId, Workspace workspace) {
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found with id " + tagId));
        if (!tag.getWorkspace().getId().equals(workspace.getId())) {
            throw new ResourceNotFoundException("Tag not found with id " + tagId);
        }
        return tag;
    }
}
