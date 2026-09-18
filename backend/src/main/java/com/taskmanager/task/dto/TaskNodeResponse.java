package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import com.taskmanager.task.Task;
import com.taskmanager.task.TaskStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * One node of the task tree, carrying its own children — so a single response
 * describes a hierarchy of any depth. The recursion is in the data, not in a
 * fixed set of "subtask" fields, which is what lets nesting be unlimited.
 *
 * @param weight               this node's share of its parent's effort
 * @param progress             weighted completion 0..100 (see {@code TaskProgressService})
 * @param depth                distance from the root; the UI indents by this
 * @param allocatedChildWeight how much of {@link #weight} the children already claim
 * @param availableChildWeight how much is still free for a new child
 * @param children             direct children, in user-arranged order
 */
public record TaskNodeResponse(
        Long id,
        String title,
        String description,
        Priority priority,
        TaskStatus status,
        LocalDate startDate,
        LocalDate dueDate,
        Long parentId,
        int weight,
        int progress,
        int depth,
        int position,
        int allocatedChildWeight,
        int availableChildWeight,
        Long projectId,
        String projectName,
        Long ownerId,
        String ownerName,
        Instant createdAt,
        Instant updatedAt,
        List<TaskNodeResponse> children
) {
    public static TaskNodeResponse of(Task task, List<TaskNodeResponse> children) {
        int allocated = children.stream().mapToInt(TaskNodeResponse::weight).sum();

        return new TaskNodeResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority(),
                task.getStatus(),
                task.getStartDate(),
                task.getDueDate(),
                task.getParentId(),
                task.getWeight(),
                task.getProgress(),
                task.getDepth(),
                task.getPosition(),
                allocated,
                Math.max(0, task.getWeight() - allocated),
                task.getProject() != null ? task.getProject().getId() : null,
                task.getProject() != null ? task.getProject().getName() : null,
                task.getUser().getId(),
                task.getUser().getName(),
                task.getCreatedAt(),
                task.getUpdatedAt(),
                children
        );
    }

    /** True when this node has no children — the UI hides the expand chevron. */
    public boolean leaf() {
        return children.isEmpty();
    }
}
