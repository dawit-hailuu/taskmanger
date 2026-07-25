package com.taskmanager.auth.repository;

import com.taskmanager.auth.model.EmailVerificationToken;
import com.taskmanager.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update EmailVerificationToken t set t.used = true where t.user = :user and t.used = false")
    int invalidateAllForUser(@Param("user") User user);
}
