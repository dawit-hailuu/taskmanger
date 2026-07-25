package com.taskmanager.exception;

/** Raised when a request conflicts with existing state (HTTP 409), e.g. a duplicate membership. */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
