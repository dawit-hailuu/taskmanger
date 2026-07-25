package com.taskmanager.exception;

/** Raised when an outbound email could not be delivered to the SMTP server. */
public class EmailSendException extends RuntimeException {

    public EmailSendException(String message, Throwable cause) {
        super(message, cause);
    }
}
