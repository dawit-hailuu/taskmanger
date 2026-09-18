package com.taskmanager.task;

import com.taskmanager.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Guards the structural invariants of the task tree. Every write path that can
 * change the shape of the hierarchy goes through here, so the rules exist in
 * exactly one place:
 *
 * <ul>
 *   <li><strong>No circular references.</strong> A task can never become its own
 *       ancestor, directly or through any number of intermediate levels.</li>
 *   <li><strong>Children fit the parent's weight.</strong> Siblings may not claim
 *       more than the parent's own weight in total.</li>
 *   <li><strong>Derived bookkeeping.</strong> {@code depth} and {@code position}
 *       are maintained here rather than by callers.</li>
 * </ul>
 *
 * <p>Depends only on the repository, so it can be reused by both
 * {@link TaskService} (create/update) and {@link TaskTreeService} (add child,
 * move, reweight) without a dependency cycle.
 */
@Service
public class TaskHierarchyService {

    private final TaskRepository taskRepository;

    public TaskHierarchyService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    // ----- circular reference prevention -----

    /**
     * Rejects any re-parenting that would create a cycle.
     *
     * <p>Checks the candidate parent against the task's full descendant set — a
     * single recursive query — rather than only comparing ids or walking one
     * level. Attaching a task under its own grandchild is just as circular as
     * attaching it under itself.
     */
    public void assertNoCircularReference(Task task, Task newParent) {
        if (newParent == null || task.getId() == null) {
            return;
        }
        if (newParent.getId().equals(task.getId())) {
            throw new BadRequestException("A task cannot be its own parent.");
        }

        List<Long> descendants = taskRepository.findDescendantIds(task.getId());
        if (descendants.contains(newParent.getId())) {
            throw new BadRequestException(
                    "\"" + newParent.getTitle() + "\" is already nested under \"" + task.getTitle()
                            + "\", so it can't also become its parent.");
        }
    }

    // ----- weight budget -----

    /**
     * Rejects a child weight that would overflow the parent's budget.
     *
     * <p>Example: parent weight 100 with children of 40 and 35 leaves 25. A third
     * child of 25 is fine; a third child of 30 is not.
     *
     * @param excludedChildId the child being re-weighted, so its current weight is
     *                        not counted against the budget it must fit into.
     *                        {@code null} when adding a new child.
     */
    @Transactional(readOnly = true)
    public void assertWeightFitsParent(Task parent, int weight, Long excludedChildId) {
        if (parent == null) {
            // Root tasks have no parent budget to fit inside; the column CHECK
            // constraint plus bean validation already bound the value.
            return;
        }

        int allocated = excludedChildId == null
                ? taskRepository.sumChildWeights(parent.getId())
                : taskRepository.sumChildWeightsExcluding(parent.getId(), excludedChildId);

        int available = parent.getWeight() - allocated;
        if (weight > available) {
            throw new BadRequestException(
                    "Weight %d doesn't fit under \"%s\": %d of %d is already allocated to other subtasks, leaving %d."
                            .formatted(weight, parent.getTitle(), allocated, parent.getWeight(),
                                    Math.max(0, available)));
        }
    }

    /** How much of a task's weight is still unclaimed by its children. */
    @Transactional(readOnly = true)
    public int availableChildWeight(Task parent) {
        return Math.max(0, parent.getWeight() - taskRepository.sumChildWeights(parent.getId()));
    }

    /**
     * Weight to give a new child when the caller didn't specify one: whatever the
     * parent has left, or 1 when the budget is already fully allocated (the caller
     * then has to rebalance explicitly, which beats silently rejecting the add).
     */
    @Transactional(readOnly = true)
    public int defaultChildWeight(Task parent) {
        if (parent == null) {
            return Task.DEFAULT_WEIGHT;
        }
        return Math.max(1, availableChildWeight(parent));
    }

    // ----- derived bookkeeping -----

    /** Depth a task sits at once attached to {@code parent}. */
    public int depthUnder(Task parent) {
        return parent == null ? 0 : parent.getDepth() + 1;
    }

    /** Next free sibling position, for appending. */
    @Transactional(readOnly = true)
    public int nextPosition(Long ownerId, Task parent) {
        int max = parent == null
                ? taskRepository.maxRootPosition(ownerId)
                : taskRepository.maxChildPosition(parent.getId());
        return max + 1;
    }

    /**
     * Applies a parent change to a task and re-stamps the depth of everything
     * beneath it in one statement, so the cost is independent of subtree size.
     */
    @Transactional
    public void attachTo(Task task, Task parent) {
        task.setParent(parent);
        task.setDepth(depthUnder(parent));
        taskRepository.save(task);

        if (task.getId() != null) {
            taskRepository.restampSubtreeDepth(task.getId(), task.getDepth());
        }
    }

    /**
     * Inserts {@code task} at {@code targetIndex} among its siblings and renumbers
     * the rest, so positions stay a dense 0..n-1 sequence the UI can rely on.
     * A {@code null} index appends.
     */
    @Transactional
    public void reorderWithin(Task task, Long ownerId, Integer targetIndex) {
        Task parent = task.getParent();

        List<Task> siblings = parent == null
                ? rootSiblings(ownerId)
                : taskRepository.findByParent_IdOrderByPositionAscIdAsc(parent.getId());

        List<Task> ordered = new java.util.ArrayList<>(siblings);
        ordered.removeIf(sibling -> sibling.getId().equals(task.getId()));

        int index = targetIndex == null ? ordered.size() : Math.min(targetIndex, ordered.size());
        ordered.add(index, task);

        for (int i = 0; i < ordered.size(); i++) {
            Task sibling = ordered.get(i);
            if (sibling.getPosition() != i) {
                sibling.setPosition(i);
                taskRepository.save(sibling);
            }
        }
    }

    private List<Task> rootSiblings(Long ownerId) {
        return taskRepository.findAll(
                TaskSpecifications.ownedBy(ownerId).and(TaskSpecifications.isRoot()),
                org.springframework.data.domain.Sort.by("position").ascending()
                        .and(org.springframework.data.domain.Sort.by("id").ascending()));
    }
}
