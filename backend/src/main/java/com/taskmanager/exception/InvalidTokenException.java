package com.taskmanager.exception;

/** Raised when a verification/reset/refresh token is missing, expired, or already used. */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException(String message) {
        super(message);
    }
}
