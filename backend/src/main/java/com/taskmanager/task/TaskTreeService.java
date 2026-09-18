package com.taskmanager.task;

import com.taskmanager.task.dto.CreateChildTaskRequest;
import com.taskmanager.task.dto.MoveTaskRequest;
import com.taskmanager.task.dto.TaskNodeResponse;
import com.taskmanager.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Read and write API for the task tree.
 *
 * <p>Reads assemble a nested {@link TaskNodeResponse} from a flat result set
 * fetched by a single recursive query, so serving a hierarchy costs one round-trip
 * no matter how deep it goes — there is no per-level query and no depth constant
 * anywhere in this class.
 *
 * <p>Writes delegate the structural rules to {@link TaskHierarchyService} (no
 * cycles, weights fit the parent, depth/position bookkeeping) and the completion
 * maths to {@link TaskProgressService}, keeping this class about orchestration.
 */
@Service
public class TaskTreeService {

    private final TaskRepository taskRepository;
    private final TaskService taskService;
    private final TaskHierarchyService hierarchyService;
    private final TaskProgressService progressService;
    private final TaskHistoryService taskHistoryService;

    public TaskTreeService(TaskRepository taskRepository,
                           TaskService taskService,
                           TaskHierarchyService hierarchyService,
                           TaskProgressService progressService,
                           TaskHistoryService taskHistoryService) {
        this.taskRepository = taskRepository;
        this.taskService = taskService;
        this.hierarchyService = hierarchyService;
        this.progressService = progressService;
        this.taskHistoryService = taskHistoryService;
    }

    // ---------------- reads ----------------

    /** The task plus every descendant, nested, at unlimited depth. */
    @Transactional(readOnly = true)
    public TaskNodeResponse tree(User user, Long taskId) {
        Task root = taskService.getAccessibleTask(user, taskId);
        List<Task> flat = taskRepository.findSubtree(root.getId());
        return assemble(root.getId(), indexByParent(flat), byId(flat));
    }

    /**
     * Nested trees for a batch of root ids — used by the paged tree endpoint, so
     * one page of roots and all their descendants load together.
     */
    @Transactional(readOnly = true)
    public List<TaskNodeResponse> forest(Collection<Long> rootIds) {
        if (rootIds.isEmpty()) {
            return List.of();
        }
        List<Task> flat = taskRepository.findSubtrees(rootIds);
        Map<Long, List<Task>> byParent = indexByParent(flat);
        Map<Long, Task> byId = byId(flat);

        // Preserve the caller's ordering — it came from a sorted, paged query.
        return rootIds.stream()
                .filter(byId::containsKey)
                .map(id -> assemble(id, byParent, byId))
                .toList();
    }

    /** Direct children only — the lazy-expand case for a large tree. */
    @Transactional(readOnly = true)
    public List<Task> children(User user, Long taskId) {
        Task parent = taskService.getAccessibleTask(user, taskId);
        List<Task> children = taskRepository.findByParent_IdOrderByPositionAscIdAsc(parent.getId());
        children.forEach(taskService::touchLazyAssociations);
        return children;
    }

    // ---------------- writes ----------------

    /**
     * Adds a child under {@code parentId}. Works identically at every level —
     * a subtask of a subtask of a subtask takes exactly this path.
     */
    @Transactional
    public Task addChild(User user, Long parentId, CreateChildTaskRequest request) {
        Task parent = taskService.getAccessibleTask(user, parentId);

        int weight = request.weight() != null
                ? request.weight()
                : hierarchyService.defaultChildWeight(parent);
        hierarchyService.assertWeightFitsParent(parent, weight, null);

        Task child = Task.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority() != null ? request.priority() : parent.getPriority())
                .status(TaskStatus.TODO)
                .dueDate(request.dueDate())
                .user(parent.getUser())
                .build();
        // Children inherit the project so project-scoped access keeps working
        // consistently down the whole tree.
        child.setProject(parent.getProject());
        child.setParent(parent);
        child.setWeight(weight);
        child.setDepth(hierarchyService.depthUnder(parent));
        child.setPosition(hierarchyService.nextPosition(parent.getUser().getId(), parent));

        Task saved = taskRepository.save(child);
        taskHistoryService.log(parent, user, "Subtask added: " + saved.getTitle());

        progressService.recomputeFrom(parent);

        taskService.touchLazyAssociations(saved);
        return saved;
    }

    /**
     * Re-parents and/or reorders a task — the drag & drop endpoint.
     *
     * <p>Both chains are re-derived afterwards: the old parent now averages over
     * fewer children, the new one over more.
     */
    @Transactional
    public Task move(User user, Long taskId, MoveTaskRequest request) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Task oldParent = task.getParent();
        Task newParent = request.parentId() != null
                ? taskService.getAccessibleTask(user, request.parentId())
                : null;

        hierarchyService.assertNoCircularReference(task, newParent);
        hierarchyService.assertWeightFitsParent(newParent, task.getWeight(), task.getId());

        boolean reparented = !sameTask(oldParent, newParent);

        hierarchyService.attachTo(task, newParent);
        hierarchyService.reorderWithin(task, task.getUser().getId(), request.position());

        if (reparented) {
            taskHistoryService.log(task, user, newParent == null
                    ? "Promoted to a top-level task"
                    : "Moved under #" + newParent.getId() + " (" + newParent.getTitle() + ")");
            progressService.recomputeFrom(oldParent);
            progressService.recomputeFrom(newParent);
        }

        taskService.touchLazyAssociations(task);
        return task;
    }

    /** Changes a task's weight, then re-derives every ancestor's average. */
    @Transactional
    public Task reweight(User user, Long taskId, int weight) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Task parent = task.getParent();

        if (task.getWeight() != weight) {
            hierarchyService.assertWeightFitsParent(parent, weight, task.getId());
            int previous = task.getWeight();
            task.setWeight(weight);
            taskRepository.save(task);
            taskHistoryService.log(task, user, "Weight changed from " + previous + " to " + weight);

            // The task's own progress is unaffected; its parent's average is not.
            progressService.recomputeFrom(parent);
        }

        taskService.touchLazyAssociations(task);
        return task;
    }

    // ---------------- assembly helpers ----------------

    /**
     * Turns the flat result set into a nested structure. Recursion follows the
     * in-memory child index, so no further queries are issued regardless of depth.
     */
    private TaskNodeResponse assemble(Long id, Map<Long, List<Task>> byParent, Map<Long, Task> byId) {
        Task task = byId.get(id);
        List<TaskNodeResponse> children = byParent.getOrDefault(id, List.of()).stream()
                .map(child -> assemble(child.getId(), byParent, byId))
                .toList();
        return TaskNodeResponse.of(task, children);
    }

    private Map<Long, List<Task>> indexByParent(List<Task> flat) {
        Map<Long, List<Task>> byParent = new HashMap<>();
        for (Task task : flat) {
            Long parentId = task.getParentId();
            if (parentId != null) {
                byParent.computeIfAbsent(parentId, key -> new ArrayList<>()).add(task);
            }
        }
        Comparator<Task> siblingOrder = Comparator.comparingInt(Task::getPosition)
                .thenComparing(Task::getId);
        byParent.values().forEach(siblings -> siblings.sort(siblingOrder));
        return byParent;
    }

    private Map<Long, Task> byId(List<Task> flat) {
        Map<Long, Task> byId = new HashMap<>();
        flat.forEach(task -> byId.put(task.getId(), task));
        return byId;
    }

    private boolean sameTask(Task a, Task b) {
        if (a == null || b == null) {
            return a == b;
        }
        return a.getId().equals(b.getId());
    }
}
