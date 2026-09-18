package com.taskmanager.task.dto;

import com.taskmanager.task.Priority;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Payload for adding a child anywhere in the task tree.
 *
 * <p>Only the title is required, so the UI can offer a one-field inline
 * "add subtask" at any depth. Everything else falls back to a sensible
 * default or is inherited from the parent.
 *
 * @param weight the child's share of the parent's effort. Omit to let the
 *               server allocate whatever the parent has left (or an even split
 *               when nothing is left to give).
 */
public record CreateChildTaskRequest(

        @NotBlank(message = "Title is required")
        @Size(max = 150, message = "Title must not exceed 150 characters")
        String title,

        @Size(max = 5000, message = "Description must not exceed 5000 characters")
        String description,

        @Min(value = 1, message = "Weight must be at least 1")
        @Max(value = 1_000_000, message = "Weight is unreasonably large")
        Integer weight,

        /** Defaults to the parent's priority when omitted. */
        Priority priority,

        LocalDate dueDate
) {
}
