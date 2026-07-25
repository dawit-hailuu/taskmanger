package com.taskmanager.auth.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "email_verification_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_evt_token_hash", columnNames = "token_hash"),
        indexes = @Index(name = "idx_evt_user", columnList = "user_id")
)
public class EmailVerificationToken extends SingleUseToken {
}
