package com.taskmanager.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload for "Continue with Google" via the custom-button popup flow.
 *
 * @param code       the authorization code Google's {@code initCodeClient} popup handed
 *                   back to the browser. Exchanged server-side (with the client secret,
 *                   never sent to the browser) for the ID token it belongs to.
 * @param rememberMe opt into the extended refresh-token lifetime, exactly as
 *                   {@link LoginRequest} does for password sign-in.
 */
public record GoogleCodeLoginRequest(

        @NotBlank(message = "Google authorization code is required")
        String code,

        boolean rememberMe
) {
}
