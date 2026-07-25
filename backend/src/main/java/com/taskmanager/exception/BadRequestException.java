package com.taskmanager.exception;

/** Raised for client errors that don't fit a more specific exception (HTTP 400). */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
