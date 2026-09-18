package com.taskmanager.task.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Changes a task's weight. Rejected when the new value would push the parent's
 * children past the parent's own weight — the invariant behind the whole
 * weighted-progress model.
 */
public record UpdateTaskWeightRequest(

        @NotNull(message = "Weight is required")
        @Min(value = 1, message = "Weight must be at least 1")
        @Max(value = 1_000_000, message = "Weight is unreasonably large")
        Integer weight
) {
}
