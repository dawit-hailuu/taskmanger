package com.taskmanager.exception;

/** Raised at login when the account's email address has not yet been verified. */
public class EmailNotVerifiedException extends RuntimeException {

    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
