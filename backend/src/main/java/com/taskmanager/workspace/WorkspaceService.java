package com.taskmanager.workspace;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ConflictException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import com.taskmanager.workspace.dto.AddWorkspaceMemberRequest;
import com.taskmanager.workspace.dto.CreateWorkspaceRequest;
import com.taskmanager.workspace.dto.UpdateWorkspaceRequest;
import com.taskmanager.workspace.dto.WorkspaceMemberResponse;
import com.taskmanager.workspace.dto.WorkspaceResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class WorkspaceService {

    private static final Set<WorkspaceRole> MANAGE_ROLES = Set.of(WorkspaceRole.ADMIN, WorkspaceRole.OWNER);

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final UserRepository userRepository;

    public WorkspaceService(WorkspaceRepository workspaceRepository,
                            WorkspaceMemberRepository memberRepository,
                            UserRepository userRepository) {
        this.workspaceRepository = workspaceRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    /** Called once at registration to give every new user a home for solo work. */
    @Transactional
    public void createPersonalWorkspace(User user) {
        Workspace workspace = new Workspace();
        workspace.setName("Personal Workspace");
        workspace.setType(WorkspaceType.PERSONAL);
        workspace.setCreatedBy(user);
        workspaceRepository.save(workspace);
        memberRepository.save(new WorkspaceMember(workspace, user, WorkspaceRole.OWNER));
    }

    @Transactional
    public WorkspaceResponse create(User creator, CreateWorkspaceRequest request) {
        Workspace workspace = new Workspace();
        workspace.setName(request.name());
        workspace.setDescription(request.description());
        workspace.setType(WorkspaceType.TEAM);
        workspace.setCreatedBy(creator);
        Workspace saved = workspaceRepository.save(workspace);
        memberRepository.save(new WorkspaceMember(saved, creator, WorkspaceRole.OWNER));

        return WorkspaceResponse.from(saved, WorkspaceRole.OWNER, 1);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> listForUser(User user) {
        return memberRepository.findByUser(user).stream()
                .map(m -> WorkspaceResponse.from(m.getWorkspace(), m.getRole(),
                        memberRepository.countByWorkspace(m.getWorkspace())))
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse getWorkspace(User user, Long workspaceId) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        WorkspaceMember membership = requireMembership(workspace, user);
        return WorkspaceResponse.from(workspace, membership.getRole(),
                memberRepository.countByWorkspace(workspace));
    }

    @Transactional
    public WorkspaceResponse update(User user, Long workspaceId, UpdateWorkspaceRequest request) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        WorkspaceMember membership = requireMembership(workspace, user);
        requireRole(membership, MANAGE_ROLES);

        workspace.setName(request.name());
        workspace.setDescription(request.description());
        workspaceRepository.save(workspace);

        return WorkspaceResponse.from(workspace, membership.getRole(),
                memberRepository.countByWorkspace(workspace));
    }

    @Transactional
    public void delete(User user, Long workspaceId) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        WorkspaceMember membership = requireMembership(workspace, user);
        requireRole(membership, Set.of(WorkspaceRole.OWNER));

        if (workspace.getType() == WorkspaceType.PERSONAL) {
            throw new BadRequestException("Your personal workspace cannot be deleted.");
        }
        workspaceRepository.delete(workspace);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> listMembers(User user, Long workspaceId) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        requireMembership(workspace, user);
        return memberRepository.findByWorkspace(workspace).stream()
                .map(WorkspaceMemberResponse::from)
                .toList();
    }

    @Transactional
    public WorkspaceMemberResponse addMember(User actingUser, Long workspaceId, AddWorkspaceMemberRequest request) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        WorkspaceMember actingMembership = requireMembership(workspace, actingUser);
        requireRole(actingMembership, MANAGE_ROLES);

        User invitee = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found with email " + request.email()));

        if (memberRepository.findByWorkspaceAndUser(workspace, invitee).isPresent()) {
            throw new ConflictException(invitee.getEmail() + " is already a member of this workspace.");
        }

        WorkspaceMember member = memberRepository.save(
                new WorkspaceMember(workspace, invitee, request.role()));
        return WorkspaceMemberResponse.from(member);
    }

    @Transactional
    public void removeMember(User actingUser, Long workspaceId, Long targetUserId) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        WorkspaceMember actingMembership = requireMembership(workspace, actingUser);
        requireRole(actingMembership, MANAGE_ROLES);

        WorkspaceMember target = memberRepository.findByWorkspaceAndUser(workspace, userOrThrow(targetUserId))
                .orElseThrow(() -> new ResourceNotFoundException("That user is not a member of this workspace."));

        guardLastOwner(workspace, target);
        memberRepository.delete(target);
    }

    @Transactional
    public WorkspaceMemberResponse changeMemberRole(User actingUser, Long workspaceId, Long targetUserId,
                                                    WorkspaceRole newRole) {
        Workspace workspace = getWorkspaceOrThrow(workspaceId);
        WorkspaceMember actingMembership = requireMembership(workspace, actingUser);
        requireRole(actingMembership, Set.of(WorkspaceRole.OWNER));

        WorkspaceMember target = memberRepository.findByWorkspaceAndUser(workspace, userOrThrow(targetUserId))
                .orElseThrow(() -> new ResourceNotFoundException("That user is not a member of this workspace."));

        if (target.getRole() == WorkspaceRole.OWNER && newRole != WorkspaceRole.OWNER) {
            guardLastOwner(workspace, target);
        }

        target.setRole(newRole);
        return WorkspaceMemberResponse.from(target);
    }

    // ---- shared helpers (also used by ProjectService) ----

    @Transactional(readOnly = true)
    public Workspace getWorkspaceOrThrow(Long workspaceId) {
        return workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace not found with id " + workspaceId));
    }

    @Transactional(readOnly = true)
    public WorkspaceMember requireMembership(Workspace workspace, User user) {
        return memberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace not found with id " + workspace.getId()));
    }

    public void requireRole(WorkspaceMember membership, Set<WorkspaceRole> allowedRoles) {
        if (!allowedRoles.contains(membership.getRole())) {
            throw new AccessDeniedException("You do not have permission to perform this action.");
        }
    }

    private void guardLastOwner(Workspace workspace, WorkspaceMember target) {
        if (target.getRole() == WorkspaceRole.OWNER
                && memberRepository.countByWorkspaceAndRole(workspace, WorkspaceRole.OWNER) <= 1) {
            throw new BadRequestException("A workspace must have at least one owner.");
        }
    }

    private User userOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + userId));
    }
}
