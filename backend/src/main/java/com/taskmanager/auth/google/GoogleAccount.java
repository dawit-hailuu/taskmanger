package com.taskmanager.auth.google;

/**
 * The claims we care about from a verified Google ID token.
 *
 * @param subject       Google's stable, immutable user id ({@code sub}). This — not the
 *                      email — is the durable identity, since users can change email.
 * @param email         verified email address on the Google account
 * @param emailVerified whether Google itself has verified that email
 * @param name          display name, may be blank
 * @param pictureUrl    avatar URL, may be {@code null}
 */
public record GoogleAccount(
        String subject,
        String email,
        boolean emailVerified,
        String name,
        String pictureUrl
) {
    /** Falls back to the local-part of the email when Google sends no name. */
    public String displayName() {
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }
}
