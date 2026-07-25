package com.taskmanager.user;

/**
 * Lifecycle state of a user account.
 *
 * <ul>
 *   <li>{@code PENDING}     — registered but email not yet verified; cannot sign in.</li>
 *   <li>{@code ACTIVE}      — verified and allowed to sign in.</li>
 *   <li>{@code DEACTIVATED} — disabled by an administrator; cannot sign in.</li>
 * </ul>
 */
public enum AccountStatus {
    PENDING,
    ACTIVE,
    DEACTIVATED
}
