package com.taskmanager.auth.dto;

/**
 * Public, unauthenticated description of which sign-in methods this deployment
 * offers. Lets the frontend render each "Continue with…" button only when the
 * server can actually honour it, and keeps every OAuth client id configured in
 * exactly one place (the backend) instead of duplicated into the Angular
 * environment.
 *
 * @param googleEnabled  whether Google Sign-In is configured
 * @param googleClientId the public OAuth client id, or {@code null} when disabled.
 *                       This value is public by design — it identifies the app to
 *                       Google and is embedded in the browser either way.
 * @param githubEnabled  whether GitHub Sign-In is configured (client id AND secret set)
 * @param githubClientId the public OAuth client id, or {@code null} when disabled.
 *                       GitHub's client secret is never exposed here or anywhere
 *                       client-facing — only the backend ever holds it.
 * @param appleEnabled   always {@code false} today. Declared now so the frontend's
 *                       "Continue with Apple" button is already wired to this flag —
 *                       flipping it on later needs no frontend change, only a real
 *                       Sign in with Apple implementation behind it.
 */
public record AuthConfigResponse(
        boolean googleEnabled,
        String googleClientId,
        boolean githubEnabled,
        String githubClientId,
        boolean appleEnabled
) {
}
