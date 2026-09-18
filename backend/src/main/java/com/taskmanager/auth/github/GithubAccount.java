package com.taskmanager.auth.github;

/**
 * The fields we care about from a verified GitHub account, after exchanging an
 * authorization code and calling GitHub's REST API.
 *
 * @param id       GitHub's stable, immutable numeric user id — the durable
 *                 identity, since a login (username) or email can both change.
 * @param login    GitHub username, used as a display-name fallback only.
 * @param email    the account's primary, verified email address.
 * @param name     display name, may be blank.
 * @param avatarUrl avatar URL, may be {@code null}.
 */
public record GithubAccount(
        long id,
        String login,
        String email,
        String name,
        String avatarUrl
) {
    /** Falls back to the GitHub login when the profile has no display name set. */
    public String displayName() {
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        return login;
    }
}
