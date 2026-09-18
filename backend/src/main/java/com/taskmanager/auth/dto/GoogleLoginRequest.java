package com.taskmanager.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload for "Continue with Google".
 *
 * @param credential the ID token issued by Google Identity Services in the
 *                   browser. Verified server-side against Google's JWKS — never
 *                   trusted as-is.
 * @param rememberMe opt into the extended refresh-token lifetime, exactly as
 *                   {@link LoginRequest} does for password sign-in.
 */
public record GoogleLoginRequest(

        @NotBlank(message = "Google credential is required")
        String credential,

        boolean rememberMe
) {
}
