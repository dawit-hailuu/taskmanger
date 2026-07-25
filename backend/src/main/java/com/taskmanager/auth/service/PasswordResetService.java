package com.taskmanager.auth.service;

import com.taskmanager.auth.model.PasswordResetToken;
import com.taskmanager.auth.repository.PasswordResetTokenRepository;
import com.taskmanager.auth.support.Tokens;
import com.taskmanager.exception.InvalidTokenException;
import com.taskmanager.mail.EmailService;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService mailService;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final Duration ttl;

    public PasswordResetService(PasswordResetTokenRepository tokenRepository,
                                UserRepository userRepository,
                                EmailService mailService,
                                PasswordEncoder passwordEncoder,
                                RefreshTokenService refreshTokenService,
                                @Value("${app.reset.expiration-ms}") long ttlMs) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
        this.ttl = Duration.ofMillis(ttlMs);
    }

    /**
     * Emails a reset link if the address matches an account. To avoid leaking
     * which emails are registered, this method never signals whether the user
     * exists — callers always return the same generic response.
     */
    @Transactional
    public void requestReset(String email) {
        userRepository.findByEmail(email).ifPresentOrElse(user -> {
            tokenRepository.invalidateAllForUser(user);

            String raw = Tokens.generate();
            PasswordResetToken token = new PasswordResetToken();
            token.setUser(user);
            token.setTokenHash(Tokens.hash(raw));
            token.setExpiresAt(Instant.now().plus(ttl));
            token.setCreatedAt(Instant.now());
            tokenRepository.save(token);

            mailService.sendPasswordResetEmail(user, raw);
        }, () -> log.info("Password reset requested for unknown email (ignored): {}", email));
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(Tokens.hash(rawToken))
                .orElseThrow(() -> new InvalidTokenException("Invalid password reset token"));

        if (!token.isUsable()) {
            throw new InvalidTokenException("This reset link has expired or was already used");
        }

        token.setUsed(true);
        User user = token.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Any session opened with the old password must not survive a reset.
        refreshTokenService.revokeAllForUser(user);
        mailService.sendPasswordChangedEmail(user);
    }
}
