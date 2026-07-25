package com.taskmanager.auth.service;

import com.taskmanager.auth.model.EmailVerificationToken;
import com.taskmanager.auth.repository.EmailVerificationTokenRepository;
import com.taskmanager.auth.support.Tokens;
import com.taskmanager.exception.EmailAlreadyVerifiedException;
import com.taskmanager.exception.ExpiredTokenException;
import com.taskmanager.exception.InvalidTokenException;
import com.taskmanager.mail.EmailService;
import com.taskmanager.profile.UserActivityService;
import com.taskmanager.profile.UserActivityType;
import com.taskmanager.user.AccountStatus;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class EmailVerificationService {

    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final UserActivityService userActivityService;
    private final Duration ttl;

    public EmailVerificationService(EmailVerificationTokenRepository tokenRepository,
                                    UserRepository userRepository,
                                    EmailService emailService,
                                    UserActivityService userActivityService,
                                    @Value("${app.verification.expiration-ms}") long ttlMs) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.userActivityService = userActivityService;
        this.ttl = Duration.ofMillis(ttlMs);
    }

    /**
     * Invalidate any outstanding tokens, mint a fresh one, and email the link.
     * Runs inside the caller's transaction: if {@link EmailService} fails to
     * send, the whole operation rolls back (no orphaned token).
     */
    @Transactional
    public void createAndSend(User user) {
        tokenRepository.invalidateAllForUser(user);

        String raw = Tokens.generate();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUser(user);
        token.setTokenHash(Tokens.hash(raw));
        token.setExpiresAt(Instant.now().plus(ttl));
        token.setCreatedAt(Instant.now());
        tokenRepository.save(token);

        emailService.sendVerificationEmail(user, raw);
    }

    /**
     * Validate a verification token and activate the account. Distinguishes
     * invalid, already-verified, already-used, and expired tokens.
     */
    @Transactional
    public void verify(String rawToken) {
        EmailVerificationToken token = tokenRepository.findByTokenHash(Tokens.hash(rawToken))
                .orElseThrow(() -> new InvalidTokenException("This verification link is invalid."));

        User user = token.getUser();

        if (user.isEmailVerified()) {
            throw new EmailAlreadyVerifiedException("This email is already verified. You can sign in.");
        }
        if (token.isUsed()) {
            throw new InvalidTokenException("This verification link has already been used.");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new ExpiredTokenException(
                    "This verification link has expired. Request a new one from the sign-in page.");
        }

        token.setUsed(true);
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
        userRepository.save(user);
        userActivityService.log(user, UserActivityType.EMAIL_VERIFIED, "Email address verified");
    }
}
