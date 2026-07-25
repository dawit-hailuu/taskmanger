package com.taskmanager.task;

import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.project.Project;
import com.taskmanager.project.ProjectService;
import com.taskmanager.task.dto.TaskRequest;
import com.taskmanager.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectService projectService;
    private final TaskHistoryService taskHistoryService;

    public TaskService(TaskRepository taskRepository, ProjectService projectService,
                       TaskHistoryService taskHistoryService) {
        this.taskRepository = taskRepository;
        this.projectService = projectService;
        this.taskHistoryService = taskHistoryService;
    }

    /** Whitelist of sortable fields to prevent arbitrary property injection. */
    private static final Set<String> SORTABLE_FIELDS =
            Set.of("createdAt", "updatedAt", "dueDate", "priority", "status", "title");

    @Transactional(readOnly = true)
    public Page<Task> search(User owner,
                             String keyword,
                             TaskStatus status,
                             Priority priority,
                             int page,
                             int size,
                             String sortBy,
                             String direction) {

        Specification<Task> spec = TaskSpecifications.ownedBy(owner.getId());

        if (StringUtils.hasText(keyword)) {
            spec = spec.and(TaskSpecifications.matchesKeyword(keyword.trim()));
        }
        if (status != null) {
            spec = spec.and(TaskSpecifications.hasStatus(status));
        }
        if (priority != null) {
            spec = spec.and(TaskSpecifications.hasPriority(priority));
        }

        Pageable pageable = buildPageable(page, size, sortBy, direction);
        Page<Task> result = taskRepository.findAll(spec, pageable);
        result.forEach(this::touchLazyAssociations);
        return result;
    }

    /** Lists a project's tasks (visible to any member/workspace manager of that project). */
    @Transactional(readOnly = true)
    public Page<Task> searchByProject(User user, Long projectId, int page, int size,
                                      String sortBy, String direction) {
        projectService.assertAccess(user, projectId);
        Pageable pageable = buildPageable(page, size, sortBy, direction);
        Page<Task> result = taskRepository.findByProjectId(projectId, pageable);
        result.forEach(this::touchLazyAssociations);
        return result;
    }

    /** Strictly owner-scoped lookup, kept for callers that must not see shared/project tasks. */
    @Transactional(readOnly = true)
    public Task getOwnedTask(User owner, Long id) {
        Task task = taskRepository.findByIdAndUserId(id, owner.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id " + id));
        touchLazyAssociations(task);
        return task;
    }

    /**
     * Shared-visibility lookup: the task's owner, or any member of the project it
     * belongs to, can view/collaborate on it. Masks existence (404) otherwise.
     * This is the base access check reused by comments, attachments, subtasks,
     * dependencies, assignees, watchers, and tags.
     */
    @Transactional(readOnly = true)
    public Task getAccessibleTask(User user, Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id " + id));

        boolean isOwner = task.getUser().getId().equals(user.getId());
        boolean isProjectMember = task.getProject() != null
                && hasProjectAccess(user, task.getProject().getId());

        if (!isOwner && !isProjectMember) {
            throw new ResourceNotFoundException("Task not found with id " + id);
        }
        touchLazyAssociations(task);
        return task;
    }

    @Transactional
    public Task create(User owner, TaskRequest request) {
        Task task = Task.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority())
                .status(request.status())
                .dueDate(request.dueDate())
                .user(owner)
                .build();
        applyOptionalFields(task, request);
        task.setProject(resolveProject(owner, request.projectId()));

        Task saved = taskRepository.save(task);
        taskHistoryService.log(saved, owner, "Task created");
        touchLazyAssociations(saved);
        return saved;
    }

    @Transactional
    public Task update(User user, Long id, TaskRequest request) {
        Task task = getAccessibleTask(user, id);

        TaskStatus previousStatus = task.getStatus();
        Priority previousPriority = task.getPriority();

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setPriority(request.priority());
        task.setStatus(request.status());
        task.setDueDate(request.dueDate());
        applyOptionalFields(task, request);
        task.setProject(resolveProject(user, request.projectId()));

        Task saved = taskRepository.save(task);

        if (previousStatus != saved.getStatus()) {
            taskHistoryService.log(saved, user,
                    "Status changed from " + previousStatus + " to " + saved.getStatus());
        }
        if (previousPriority != saved.getPriority()) {
            taskHistoryService.log(saved, user, "Priority changed to " + saved.getPriority());
        }

        if (previousStatus != TaskStatus.COMPLETED && saved.getStatus() == TaskStatus.COMPLETED
                && saved.getRecurrence() != RecurrenceType.NONE) {
            spawnNextOccurrence(saved, user);
        }

        touchLazyAssociations(saved);
        return saved;
    }

    /** Owner, or a project MANAGER/OWNER (or workspace admin), may delete a task. */
    @Transactional
    public void delete(User user, Long id) {
        Task task = getAccessibleTask(user, id);
        boolean isOwner = task.getUser().getId().equals(user.getId());
        boolean canManage = task.getProject() != null
                && projectService.canManageProject(user, task.getProject().getId());

        if (!isOwner && !canManage) {
            throw new AccessDeniedException("You do not have permission to delete this task.");
        }
        taskRepository.delete(task);
    }

    private boolean hasProjectAccess(User user, Long projectId) {
        try {
            projectService.assertAccess(user, projectId);
            return true;
        } catch (ResourceNotFoundException ex) {
            return false;
        }
    }

    private void applyOptionalFields(Task task, TaskRequest request) {
        task.setStartDate(request.startDate());
        task.setEstimatedMinutes(request.estimatedMinutes());
        if (request.actualMinutes() != null) {
            task.setActualMinutes(request.actualMinutes());
        }
        task.setRecurrence(request.recurrence() != null ? request.recurrence() : RecurrenceType.NONE);
        task.setRecurrenceEndDate(request.recurrenceEndDate());
    }

    private Project resolveProject(User user, Long projectId) {
        return projectId != null ? projectService.assertAccess(user, projectId) : null;
    }

    /**
     * When a recurring task is completed, spins up its next occurrence (same
     * title/description/priority/project/recurrence, TODO status, dates shifted
     * forward by one recurrence interval). Skipped once the shifted due date
     * would fall past {@code recurrenceEndDate}.
     */
    private void spawnNextOccurrence(Task completed, User actor) {
        LocalDate anchor = completed.getDueDate() != null ? completed.getDueDate() : LocalDate.now();
        LocalDate nextDue = shift(anchor, completed.getRecurrence());

        if (completed.getRecurrenceEndDate() != null && nextDue.isAfter(completed.getRecurrenceEndDate())) {
            return;
        }

        Task next = Task.builder()
                .title(completed.getTitle())
                .description(completed.getDescription())
                .priority(completed.getPriority())
                .status(TaskStatus.TODO)
                .dueDate(nextDue)
                .user(completed.getUser())
                .build();
        next.setProject(completed.getProject());
        next.setEstimatedMinutes(completed.getEstimatedMinutes());
        next.setRecurrence(completed.getRecurrence());
        next.setRecurrenceEndDate(completed.getRecurrenceEndDate());
        if (completed.getStartDate() != null) {
            next.setStartDate(shift(completed.getStartDate(), completed.getRecurrence()));
        }

        Task saved = taskRepository.save(next);
        taskHistoryService.log(completed, actor, "Created next recurring occurrence (#" + saved.getId() + ")");
        taskHistoryService.log(saved, actor, "Auto-created from recurring task #" + completed.getId());
    }

    private LocalDate shift(LocalDate date, RecurrenceType recurrence) {
        return switch (recurrence) {
            case DAILY -> date.plusDays(1);
            case WEEKLY -> date.plusWeeks(1);
            case MONTHLY -> date.plusMonths(1);
            case NONE -> date;
        };
    }

    /**
     * Forces the lazy {@code project} and {@code user} associations to load
     * their fields while the persistence context is still open. Needed because
     * {@code open-in-view} is disabled: {@code TaskResponse.from} runs in the
     * controller, after the transaction (and Hibernate session) that produced
     * this entity has closed.
     */
    private void touchLazyAssociations(Task task) {
        task.getUser().getName();
        if (task.getProject() != null) {
            task.getProject().getName();
        }
    }

    private Pageable buildPageable(int page, int size, String sortBy, String direction) {
        String safeSortBy = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "createdAt";
        Sort.Direction dir = "asc".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        return PageRequest.of(safePage, safeSize, Sort.by(new Sort.Order(dir, safeSortBy)));
    }

    /** Exposed for tests / callers that need the sortable field list. */
    public static List<String> sortableFields() {
        return SORTABLE_FIELDS.stream().sorted().toList();
    }
}
