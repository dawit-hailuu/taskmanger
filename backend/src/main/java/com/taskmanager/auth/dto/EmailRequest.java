package com.taskmanager.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Shared body for email-only actions (resend verification, forgot password). */
public record EmailRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be a valid address")
        String email
) {
}
