package com.taskmanager.auth.service;

import com.taskmanager.auth.model.RefreshToken;
import com.taskmanager.auth.repository.RefreshTokenRepository;
import com.taskmanager.auth.support.Tokens;
import com.taskmanager.exception.InvalidTokenException;
import com.taskmanager.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Manages the lifecycle of opaque refresh tokens: issue, rotate (single-use),
 * and revoke. Raw tokens are returned to the caller but only their hashes are
 * stored.
 */
@Service
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final Duration standardTtl;
    private final Duration rememberMeTtl;

    public RefreshTokenService(RefreshTokenRepository repository,
                               @Value("${app.refresh.expiration-ms}") long standardTtlMs,
                               @Value("${app.refresh.remember-me-expiration-ms}") long rememberMeTtlMs) {
        this.repository = repository;
        this.standardTtl = Duration.ofMillis(standardTtlMs);
        this.rememberMeTtl = Duration.ofMillis(rememberMeTtlMs);
    }

    /** The raw token plus the user it authenticates. Raw token is shown once. */
    public record IssuedToken(String rawToken, User user) {
    }

    @Transactional
    public String issue(User user, boolean rememberMe, String ip, String userAgent) {
        Instant expiresAt = Instant.now().plus(rememberMe ? rememberMeTtl : standardTtl);
        return persist(user, expiresAt, ip, userAgent);
    }

    /**
     * Validate a refresh token and rotate it: the presented token is revoked
     * and a fresh one (inheriting the original expiry) is issued. Reusing a
     * revoked/expired token is rejected.
     */
    @Transactional
    public IssuedToken rotate(String rawToken, String ip, String userAgent) {
        RefreshToken current = repository.findByTokenHash(Tokens.hash(rawToken))
                .orElseThrow(() -> new InvalidTokenException("Invalid refresh token"));

        if (!current.isActive()) {
            throw new InvalidTokenException("Refresh token is expired or revoked");
        }

        current.setRevoked(true);
        String newRaw = persist(current.getUser(), current.getExpiresAt(), ip, userAgent);
        return new IssuedToken(newRaw, current.getUser());
    }

    @Transactional
    public void revoke(String rawToken) {
        repository.findByTokenHash(Tokens.hash(rawToken)).ifPresent(t -> t.setRevoked(true));
    }

    @Transactional
    public void revokeAllForUser(User user) {
        repository.revokeAllForUser(user);
    }

    private String persist(User user, Instant expiresAt, String ip, String userAgent) {
        String raw = Tokens.generate();
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(Tokens.hash(raw));
        token.setExpiresAt(expiresAt);
        token.setUserAgent(truncate(userAgent, 255));
        token.setIpAddress(truncate(ip, 45));
        token.setCreatedAt(Instant.now());
        repository.save(token);
        return raw;
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
