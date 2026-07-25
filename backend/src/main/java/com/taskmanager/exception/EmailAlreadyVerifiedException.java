package com.taskmanager.exception;

/** Raised when verification is attempted for an already-verified account. */
public class EmailAlreadyVerifiedException extends RuntimeException {

    public EmailAlreadyVerifiedException(String message) {
        super(message);
    }
}
