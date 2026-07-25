package com.taskmanager.project;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ConflictException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.project.dto.AddProjectMemberRequest;
import com.taskmanager.project.dto.CreateProjectRequest;
import com.taskmanager.project.dto.ProjectMemberResponse;
import com.taskmanager.project.dto.ProjectResponse;
import com.taskmanager.project.dto.UpdateProjectRequest;
import com.taskmanager.task.TaskRepository;
import com.taskmanager.task.TaskStatus;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import com.taskmanager.workspace.Workspace;
import com.taskmanager.workspace.WorkspaceMember;
import com.taskmanager.workspace.WorkspaceRole;
import com.taskmanager.workspace.WorkspaceService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class ProjectService {

    private static final Set<WorkspaceRole> WORKSPACE_MANAGE_ROLES =
            Set.of(WorkspaceRole.ADMIN, WorkspaceRole.OWNER);
    private static final Set<ProjectRole> PROJECT_MANAGE_ROLES =
            Set.of(ProjectRole.MANAGER, ProjectRole.OWNER);

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final WorkspaceService workspaceService;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public ProjectService(ProjectRepository projectRepository,
                          ProjectMemberRepository projectMemberRepository,
                          WorkspaceService workspaceService,
                          UserRepository userRepository,
                          TaskRepository taskRepository) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.workspaceService = workspaceService;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    /** A resolved access check: which workspace role (if any) and project role (if any) the user holds. */
    private record Access(Project project, WorkspaceMember workspaceMembership, ProjectMember projectMembership) {

        boolean isWorkspaceManager() {
            return WORKSPACE_MANAGE_ROLES.contains(workspaceMembership.getRole());
        }

        boolean canManageProject() {
            return isWorkspaceManager()
                    || (projectMembership != null && PROJECT_MANAGE_ROLES.contains(projectMembership.getRole()));
        }

        boolean isProjectOwnerOrWorkspaceManager() {
            return isWorkspaceManager()
                    || (projectMembership != null && projectMembership.getRole() == ProjectRole.OWNER);
        }

        String myRoleLabel() {
            return projectMembership != null ? projectMembership.getRole().name() : null;
        }
    }

    @Transactional
    public ProjectResponse create(User creator, Long workspaceId, CreateProjectRequest request) {
        Workspace workspace = workspaceService.getWorkspaceOrThrow(workspaceId);
        workspaceService.requireMembership(workspace, creator);

        Project project = new Project();
        project.setWorkspace(workspace);
        project.setName(request.name());
        project.setDescription(request.description());
        project.setDeadline(request.deadline());
        project.setCreatedBy(creator);
        Project saved = projectRepository.save(project);

        ProjectMember membership = projectMemberRepository.save(
                new ProjectMember(saved, creator, ProjectRole.OWNER));

        return toResponse(saved, 1, 0, membership.getRole().name());
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> listForWorkspace(User user, Long workspaceId) {
        Workspace workspace = workspaceService.getWorkspaceOrThrow(workspaceId);
        WorkspaceMember membership = workspaceService.requireMembership(workspace, user);
        boolean isManager = WORKSPACE_MANAGE_ROLES.contains(membership.getRole());

        return projectRepository.findByWorkspaceOrderByCreatedAtDesc(workspace).stream()
                .filter(p -> isManager || projectMemberRepository.findByProjectAndUser(p, user).isPresent())
                .map(p -> {
                    String myRole = projectMemberRepository.findByProjectAndUser(p, user)
                            .map(m -> m.getRole().name())
                            .orElse(null);
                    return toResponse(p, projectMemberRepository.countByProject(p),
                            taskRepository.countByProjectId(p.getId()), myRole);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(User user, Long projectId) {
        Access access = resolveAccess(user, projectId);
        return toResponse(access.project(), projectMemberRepository.countByProject(access.project()),
                taskRepository.countByProjectId(access.project().getId()), access.myRoleLabel());
    }

    @Transactional
    public ProjectResponse update(User user, Long projectId, UpdateProjectRequest request) {
        Access access = resolveAccess(user, projectId);
        if (!access.canManageProject()) {
            throw new AccessDeniedException("You do not have permission to edit this project.");
        }

        Project project = access.project();
        project.setName(request.name());
        project.setDescription(request.description());
        project.setDeadline(request.deadline());
        projectRepository.save(project);

        return toResponse(project, projectMemberRepository.countByProject(project),
                taskRepository.countByProjectId(project.getId()), access.myRoleLabel());
    }

    @Transactional
    public void delete(User user, Long projectId) {
        Access access = resolveAccess(user, projectId);
        if (!access.isProjectOwnerOrWorkspaceManager()) {
            throw new AccessDeniedException("You do not have permission to delete this project.");
        }
        projectRepository.delete(access.project());
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> listMembers(User user, Long projectId) {
        Access access = resolveAccess(user, projectId);
        return projectMemberRepository.findByProject(access.project()).stream()
                .map(ProjectMemberResponse::from)
                .toList();
    }

    @Transactional
    public ProjectMemberResponse addMember(User user, Long projectId, AddProjectMemberRequest request) {
        Access access = resolveAccess(user, projectId);
        if (!access.canManageProject()) {
            throw new AccessDeniedException("You do not have permission to manage this project's members.");
        }

        User invitee = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found with email " + request.email()));

        if (projectMemberRepository.findByProjectAndUser(access.project(), invitee).isPresent()) {
            throw new ConflictException(invitee.getEmail() + " is already a member of this project.");
        }

        ProjectMember member = projectMemberRepository.save(
                new ProjectMember(access.project(), invitee, request.role()));
        return ProjectMemberResponse.from(member);
    }

    @Transactional
    public void removeMember(User user, Long projectId, Long targetUserId) {
        Access access = resolveAccess(user, projectId);
        if (!access.canManageProject()) {
            throw new AccessDeniedException("You do not have permission to manage this project's members.");
        }

        ProjectMember target = projectMemberRepository
                .findByProjectAndUser(access.project(), userOrThrow(targetUserId))
                .orElseThrow(() -> new ResourceNotFoundException("That user is not a member of this project."));

        guardLastOwner(access.project(), target);
        projectMemberRepository.delete(target);
    }

    @Transactional
    public ProjectMemberResponse changeMemberRole(User user, Long projectId, Long targetUserId, ProjectRole newRole) {
        Access access = resolveAccess(user, projectId);
        if (!access.isProjectOwnerOrWorkspaceManager()) {
            throw new AccessDeniedException("You do not have permission to change member roles.");
        }

        ProjectMember target = projectMemberRepository
                .findByProjectAndUser(access.project(), userOrThrow(targetUserId))
                .orElseThrow(() -> new ResourceNotFoundException("That user is not a member of this project."));

        if (target.getRole() == ProjectRole.OWNER && newRole != ProjectRole.OWNER) {
            guardLastOwner(access.project(), target);
        }

        target.setRole(newRole);
        return ProjectMemberResponse.from(target);
    }

    // ---- shared helpers (also used by TaskService) ----

    /** Verifies the user can see/use this project (workspace manager or explicit member) and returns it. */
    @Transactional(readOnly = true)
    public Project assertAccess(User user, Long projectId) {
        return resolveAccess(user, projectId).project();
    }

    /** Non-throwing check: does this user have manage-level power (MANAGER/OWNER or workspace manager)? */
    @Transactional(readOnly = true)
    public boolean canManageProject(User user, Long projectId) {
        try {
            return resolveAccess(user, projectId).canManageProject();
        } catch (ResourceNotFoundException ex) {
            return false;
        }
    }

    /** Whether the given user is an explicit member of this project (used to validate assignees/tags). */
    @Transactional(readOnly = true)
    public boolean isMember(Project project, User user) {
        return projectMemberRepository.findByProjectAndUser(project, user).isPresent();
    }

    private Access resolveAccess(User user, Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id " + projectId));

        WorkspaceMember workspaceMembership = workspaceService.requireMembership(project.getWorkspace(), user);
        ProjectMember projectMembership = projectMemberRepository
                .findByProjectAndUser(project, user).orElse(null);

        boolean isWorkspaceManager = WORKSPACE_MANAGE_ROLES.contains(workspaceMembership.getRole());
        if (!isWorkspaceManager && projectMembership == null) {
            // Mask existence from workspace members who aren't on this project.
            throw new ResourceNotFoundException("Project not found with id " + projectId);
        }

        return new Access(project, workspaceMembership, projectMembership);
    }

    private void guardLastOwner(Project project, ProjectMember target) {
        if (target.getRole() == ProjectRole.OWNER
                && projectMemberRepository.countByProjectAndRole(project, ProjectRole.OWNER) <= 1) {
            throw new BadRequestException("A project must have at least one owner.");
        }
    }

    private User userOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + userId));
    }

    private ProjectResponse toResponse(Project project, long memberCount, long taskCount, String myRole) {
        return ProjectResponse.from(project, computeProgress(project), memberCount, taskCount, myRole);
    }

    private int computeProgress(Project project) {
        long total = taskRepository.countByProjectId(project.getId());
        long cancelled = taskRepository.countByProjectIdAndStatus(project.getId(), TaskStatus.CANCELLED);
        long completed = taskRepository.countByProjectIdAndStatus(project.getId(), TaskStatus.COMPLETED);

        long denominator = total - cancelled;
        if (denominator <= 0) {
            return 0;
        }
        return (int) Math.round(completed * 100.0 / denominator);
    }
}
