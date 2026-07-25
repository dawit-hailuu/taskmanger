package com.taskmanager.user;

/**
 * System-level roles, used by Spring Security for coarse-grained
 * authorization. Fine-grained, per-project roles are handled separately
 * (see the project membership model introduced in a later phase).
 *
 * <ul>
 *   <li>{@code ROLE_USER}    — standard member</li>
 *   <li>{@code ROLE_MANAGER} — can manage teams/projects and members</li>
 *   <li>{@code ROLE_ADMIN}   — full administrative access</li>
 * </ul>
 */
public enum Role {
    ROLE_USER,
    ROLE_MANAGER,
    ROLE_ADMIN
}
