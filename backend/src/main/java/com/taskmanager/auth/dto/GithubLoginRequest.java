package com.taskmanager.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload for "Continue with GitHub".
 *
 * @param code        the authorization code GitHub redirected the browser back with.
 *                    Exchanged server-side for an access token — the client secret that
 *                    exchange needs must never reach the browser.
 * @param redirectUri the exact redirect URI used to obtain {@code code}; GitHub requires
 *                    it again for the exchange and rejects a mismatch.
 * @param rememberMe  opt into the extended refresh-token lifetime, exactly as
 *                    {@link LoginRequest} does for password sign-in.
 */
public record GithubLoginRequest(

        @NotBlank(message = "GitHub authorization code is required")
        String code,

        @NotBlank(message = "Redirect URI is required")
        String redirectUri,

        boolean rememberMe
) {
}
