package com.taskmanager.auth.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "password_reset_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_prt_token_hash", columnNames = "token_hash"),
        indexes = @Index(name = "idx_prt_user", columnList = "user_id")
)
public class PasswordResetToken extends SingleUseToken {
}
