package com.taskmanager.task;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Owns the one rule for task completion: <strong>progress is weighted, never
 * counted</strong>.
 *
 * <p>A leaf task is 0% or 100% — a pure function of its status. A task with
 * children is the weight-weighted average of those children:
 *
 * <pre>
 *   progress = Σ(child.weight × child.progress) / Σ(child.weight)
 *
 *   A (weight 40) done      →  40 × 100
 *   B (weight 35) done      →  35 × 100
 *   C (weight 25) not done  →  25 ×   0
 *                              ─────────
 *                              7500 / 100 = 75%
 * </pre>
 *
 * <p>Counting completed children would report 2/3 = 67% for the same tree, which
 * is why that approach is deliberately not used anywhere.
 *
 * <p>Because the rule is recursive, changing <em>any</em> node re-derives every
 * ancestor up to the root — at unlimited depth. The walk stops early the moment a
 * level's value is unchanged, since an ancestor's average can only move if the
 * child it averages actually moved.
 *
 * <p>Cancelled children are dropped from both sides of the fraction rather than
 * counted as 0: cancelling a subtask releases its weight to its siblings instead
 * of capping the parent below 100% forever.
 */
@Service
public class TaskProgressService {

    private static final Logger log = LoggerFactory.getLogger(TaskProgressService.class);

    /**
     * Hard stop for the upward walk. The tree is acyclic by construction
     * (see {@code TaskTreeService}), so this only ever fires if data was
     * corrupted out-of-band — better a logged warning than a hung request.
     */
    private static final int MAX_ANCESTOR_WALK = 1_000;

    private final TaskRepository taskRepository;

    public TaskProgressService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    /**
     * Re-derives {@code task}'s progress and then every ancestor's, in order.
     *
     * <p>Call this after anything that can change a weighted average: a status
     * change, a weight change, or a child being added, moved or removed. Passing
     * {@code null} (e.g. "the parent of a root task") is a no-op, so callers
     * don't need to null-check.
     */
    @Transactional
    public void recomputeFrom(Task task) {
        Task current = task;
        int walked = 0;

        while (current != null) {
            if (++walked > MAX_ANCESTOR_WALK) {
                log.warn("Aborted progress rollup after {} levels starting at task {} — "
                        + "the parent chain looks cyclic.", MAX_ANCESTOR_WALK, task.getId());
                return;
            }

            int computed = computeFor(current);
            if (computed == current.getProgress()) {
                // This level didn't move, so no ancestor's average can move either.
                return;
            }
            current.setProgress(computed);
            taskRepository.save(current);
            current = current.getParent();
        }
    }

    /**
     * The weighted progress this task should have, given the current state of its
     * direct children. Read-only — callers decide whether to persist it.
     */
    @Transactional(readOnly = true)
    public int computeFor(Task task) {
        List<Task> counted = taskRepository.findByParent_IdOrderByPositionAscIdAsc(task.getId()).stream()
                .filter(child -> child.getStatus() != TaskStatus.CANCELLED)
                .toList();

        if (counted.isEmpty()) {
            return leafProgress(task);
        }

        long totalWeight = counted.stream().mapToLong(Task::getWeight).sum();
        if (totalWeight <= 0) {
            return leafProgress(task);
        }

        long weighted = counted.stream()
                .mapToLong(child -> (long) child.getWeight() * child.getProgress())
                .sum();

        return clamp(Math.round((double) weighted / totalWeight));
    }

    /** A task with no countable children is simply done or not done. */
    private int leafProgress(Task task) {
        return task.getStatus() == TaskStatus.COMPLETED ? 100 : 0;
    }

    private int clamp(long value) {
        return (int) Math.max(0, Math.min(100, value));
    }
}
