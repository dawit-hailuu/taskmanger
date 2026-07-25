package com.taskmanager.exception;

/** Raised when a verification/reset token is valid but past its expiry. */
public class ExpiredTokenException extends RuntimeException {

    public ExpiredTokenException(String message) {
        super(message);
    }
}
