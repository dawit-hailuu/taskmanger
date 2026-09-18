package com.taskmanager.task;

import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.project.Project;
import com.taskmanager.project.ProjectService;
import com.taskmanager.task.dto.TaskRequest;
import com.taskmanager.task.dto.TaskSearchCriteria;
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
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectService projectService;
    private final TaskHistoryService taskHistoryService;
    private final TaskHierarchyService hierarchyService;
    private final TaskProgressService progressService;

    public TaskService(TaskRepository taskRepository, ProjectService projectService,
                       TaskHistoryService taskHistoryService,
                       TaskHierarchyService hierarchyService,
                       TaskProgressService progressService) {
        this.taskRepository = taskRepository;
        this.projectService = projectService;
        this.taskHistoryService = taskHistoryService;
        this.hierarchyService = hierarchyService;
        this.progressService = progressService;
    }

    /** Whitelist of sortable fields to prevent arbitrary property injection. */
    private static final Set<String> SORTABLE_FIELDS = Set.of(
            "createdAt", "updatedAt", "dueDate", "startDate",
            "priority", "status", "title", "weight", "progress", "position");

    /** Upper bound on page size, so a client can't ask for the whole table. */
    private static final int MAX_PAGE_SIZE = 100;

    @Transactional(readOnly = true)
    public Page<Task> search(User owner, TaskSearchCriteria criteria,
                             int page, int size, String sortBy, String direction) {

        Specification<Task> spec = TaskSpecifications.ownedBy(owner.getId());

        if (StringUtils.hasText(criteria.keyword())) {
            spec = spec.and(TaskSpecifications.matchesKeyword(criteria.keyword().trim()));
        }
        if (criteria.status() != null) {
            spec = spec.and(TaskSpecifications.hasStatus(criteria.status()));
        }
        if (criteria.priority() != null) {
            spec = spec.and(TaskSpecifications.hasPriority(criteria.priority()));
        }
        if (criteria.projectId() != null) {
            spec = spec.and(TaskSpecifications.inProject(criteria.projectId()));
        }
        if (criteria.parentId() != null) {
            spec = spec.and(TaskSpecifications.childOf(criteria.parentId()));
        } else if (criteria.rootsOnly()) {
            spec = spec.and(TaskSpecifications.isRoot());
        }
        if (criteria.dueFrom() != null) {
            spec = spec.and(TaskSpecifications.dueOnOrAfter(criteria.dueFrom()));
        }
        if (criteria.dueTo() != null) {
            spec = spec.and(TaskSpecifications.dueOnOrBefore(criteria.dueTo()));
        }
        if (criteria.overdueOnly()) {
            spec = spec.and(TaskSpecifications.overdueAsOf(LocalDate.now()));
        }

        Pageable pageable = buildPageable(page, size, sortBy, direction);
        Page<Task> result = taskRepository.findAll(spec, pageable);
        result.forEach(this::touchLazyAssociations);
        return result;
    }

    /** Kept for callers that only need the original keyword/status/priority search. */
    @Transactional(readOnly = true)
    public Page<Task> search(User owner, String keyword, TaskStatus status, Priority priority,
                             int page, int size, String sortBy, String direction) {
        return search(owner, TaskSearchCriteria.of(keyword, status, priority),
                page, size, sortBy, direction);
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

    /**
     * Direct-child counts for a batch of task ids, in a single query. Lets a page
     * of rows show "3 subtasks" without an N+1 storm.
     */
    @Transactional(readOnly = true)
    public Map<Long, Integer> childCounts(Collection<Long> taskIds) {
        if (taskIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : taskRepository.countChildrenByParentIds(taskIds)) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return counts;
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
        Task parent = resolveParent(owner, request.parentId());

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

        int weight = request.weight() != null
                ? request.weight()
                : hierarchyService.defaultChildWeight(parent);
        hierarchyService.assertWeightFitsParent(parent, weight, null);

        task.setParent(parent);
        task.setWeight(weight);
        task.setDepth(hierarchyService.depthUnder(parent));
        task.setPosition(hierarchyService.nextPosition(owner.getId(), parent));
        // A brand-new task has no children yet, so its progress follows its status.
        task.setProgress(request.status() == TaskStatus.COMPLETED ? 100 : 0);

        Task saved = taskRepository.save(task);
        taskHistoryService.log(saved, owner, parent == null
                ? "Task created"
                : "Subtask created under #" + parent.getId());

        // A new child changes its parent's weighted average, and every ancestor's.
        progressService.recomputeFrom(parent);

        touchLazyAssociations(saved);
        return saved;
    }

    @Transactional
    public Task update(User user, Long id, TaskRequest request) {
        Task task = getAccessibleTask(user, id);

        TaskStatus previousStatus = task.getStatus();
        Priority previousPriority = task.getPriority();
        int previousWeight = task.getWeight();

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setPriority(request.priority());
        task.setStatus(request.status());
        task.setDueDate(request.dueDate());
        applyOptionalFields(task, request);
        task.setProject(resolveProject(user, request.projectId()));

        // Weight is optional on update; omitting it must not silently reset it.
        if (request.weight() != null && request.weight() != previousWeight) {
            hierarchyService.assertWeightFitsParent(task.getParent(), request.weight(), task.getId());
            task.setWeight(request.weight());
        }

        Task saved = taskRepository.save(task);

        if (previousStatus != saved.getStatus()) {
            taskHistoryService.log(saved, user,
                    "Status changed from " + previousStatus + " to " + saved.getStatus());
        }
        if (previousPriority != saved.getPriority()) {
            taskHistoryService.log(saved, user, "Priority changed to " + saved.getPriority());
        }
        if (previousWeight != saved.getWeight()) {
            taskHistoryService.log(saved, user,
                    "Weight changed from " + previousWeight + " to " + saved.getWeight());
        }

        // A status change alters this task's own progress, so the rollup starts here.
        if (previousStatus != saved.getStatus()) {
            progressService.recomputeFrom(saved);
        }
        // A weight change leaves this task's progress untouched but moves the
        // parent's weighted average, so that rollup has to start one level up.
        if (previousWeight != saved.getWeight()) {
            progressService.recomputeFrom(saved.getParent());
        }

        if (previousStatus != TaskStatus.COMPLETED && saved.getStatus() == TaskStatus.COMPLETED
                && saved.getRecurrence() != RecurrenceType.NONE) {
            spawnNextOccurrence(saved, user);
        }

        touchLazyAssociations(saved);
        return saved;
    }

    /**
     * Changes only the status, leaving every other field untouched.
     *
     * <p>Backs the tree's completion checkbox. Runs the same side effects as a full
     * update — audit entry, weighted-progress rollup to the root, and spawning the
     * next occurrence of a recurring task — so the two paths can't drift apart.
     */
    @Transactional
    public Task changeStatus(User user, Long id, TaskStatus status) {
        Task task = getAccessibleTask(user, id);
        TaskStatus previousStatus = task.getStatus();

        if (previousStatus == status) {
            return task;
        }

        task.setStatus(status);
        Task saved = taskRepository.save(task);

        taskHistoryService.log(saved, user,
                "Status changed from " + previousStatus + " to " + status);
        progressService.recomputeFrom(saved);

        if (status == TaskStatus.COMPLETED && saved.getRecurrence() != RecurrenceType.NONE) {
            spawnNextOccurrence(saved, user);
        }

        touchLazyAssociations(saved);
        return saved;
    }

    /**
     * Owner, or a project MANAGER/OWNER (or workspace admin), may delete a task.
     *
     * <p>Deleting a task deletes its whole subtree — the {@code parent_id} foreign
     * key carries {@code ON DELETE CASCADE}, so the database removes descendants
     * at any depth in one statement. The former parent's progress is then
     * re-derived, since it now averages over fewer children.
     */
    @Transactional
    public void delete(User user, Long id) {
        Task task = getAccessibleTask(user, id);
        boolean isOwner = task.getUser().getId().equals(user.getId());
        boolean canManage = task.getProject() != null
                && projectService.canManageProject(user, task.getProject().getId());

        if (!isOwner && !canManage) {
            throw new AccessDeniedException("You do not have permission to delete this task.");
        }

        Task parent = task.getParent();
        taskRepository.delete(task);
        taskRepository.flush();

        progressService.recomputeFrom(parent);
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
     * Resolves the requested parent, enforcing the same access check as any other
     * read — you cannot nest a task under one you can't see.
     */
    private Task resolveParent(User user, Long parentId) {
        return parentId != null ? getAccessibleTask(user, parentId) : null;
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
        // The next occurrence is a sibling of the one just completed, carrying the
        // same weight so the parent's budget stays balanced.
        next.setParent(completed.getParent());
        next.setWeight(completed.getWeight());
        next.setDepth(completed.getDepth());
        next.setPosition(hierarchyService.nextPosition(
                completed.getUser().getId(), completed.getParent()));

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
    void touchLazyAssociations(Task task) {
        task.getUser().getName();
        if (task.getProject() != null) {
            task.getProject().getName();
        }
        // Same reasoning for the parent: TaskResponse exposes parentId.
        if (task.getParent() != null) {
            task.getParent().getId();
        }
    }

    private Pageable buildPageable(int page, int size, String sortBy, String direction) {
        String safeSortBy = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "createdAt";
        Sort.Direction dir = "asc".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        return PageRequest.of(safePage, safeSize, Sort.by(new Sort.Order(dir, safeSortBy)));
    }

    /** Exposed for tests / callers that need the sortable field list. */
    public static List<String> sortableFields() {
        return SORTABLE_FIELDS.stream().sorted().toList();
    }
}
