package com.taskmanager.exception;

/** Raised when a client exceeds the allowed request rate for an endpoint. */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
