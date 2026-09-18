package com.taskmanager.auth.google;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.InvalidTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Set;

/**
 * Verifies a Google-issued ID token (the {@code credential} produced by Google
 * Identity Services in the browser) and reduces it to a {@link GoogleAccount}.
 *
 * <p>Verification is cryptographic, not "trust the client": the token's RS256
 * signature is checked against Google's published JWKS (keys are fetched and
 * cached by {@link NimbusJwtDecoder}, so rotation is handled for us), and the
 * {@code iss}, {@code aud} and {@code exp} claims are all validated. Anything
 * short of that would let a caller mint their own identity.
 *
 * <p>The decoder is built once, lazily, on first use — so the application still
 * starts (with Google sign-in simply unavailable) when no client id is set.
 */
@Component
public class GoogleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleTokenVerifier.class);

    /** Google signs ID tokens under both spellings of its issuer. */
    private static final Set<String> ACCEPTED_ISSUERS =
            Set.of("https://accounts.google.com", "accounts.google.com");

    private final String clientId;
    private final String jwkSetUri;

    /** Guarded by {@link #lock}; built on first verification. */
    private volatile JwtDecoder decoder;
    private final Object lock = new Object();

    public GoogleTokenVerifier(
            @Value("${app.oauth2.google.client-id:}") String clientId,
            @Value("${app.oauth2.google.jwk-set-uri:https://www.googleapis.com/oauth2/v3/certs}") String jwkSetUri) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.jwkSetUri = jwkSetUri;
    }

    /** Whether the deployment is configured to accept Google sign-in at all. */
    public boolean isEnabled() {
        return StringUtils.hasText(clientId);
    }

    /**
     * The public OAuth client id the browser must initialise Google Identity
     * Services with, or {@code null} when Google sign-in is disabled.
     */
    public String clientId() {
        return isEnabled() ? clientId : null;
    }

    /**
     * @throws BadRequestException   when Google sign-in is not configured on this deployment
     * @throws InvalidTokenException when the credential is missing, malformed, expired,
     *                               signed by the wrong key, or issued for another client
     */
    public GoogleAccount verify(String idToken) {
        if (!isEnabled()) {
            throw new BadRequestException(
                    "Google Sign-In is not configured on this server. Use email and password instead.");
        }
        if (!StringUtils.hasText(idToken)) {
            throw new InvalidTokenException("Missing Google credential.");
        }

        Jwt jwt;
        try {
            jwt = decoder().decode(idToken);
        } catch (JwtException ex) {
            log.debug("Rejected Google ID token: {}", ex.getMessage());
            throw new InvalidTokenException("That Google sign-in could not be verified. Please try again.");
        }

        String email = jwt.getClaimAsString("email");
        if (!StringUtils.hasText(email)) {
            throw new InvalidTokenException("This Google account does not expose an email address.");
        }

        return new GoogleAccount(
                jwt.getSubject(),
                email.toLowerCase(),
                Boolean.TRUE.equals(jwt.getClaim("email_verified")),
                jwt.getClaimAsString("name"),
                jwt.getClaimAsString("picture")
        );
    }

    private JwtDecoder decoder() {
        JwtDecoder existing = this.decoder;
        if (existing != null) {
            return existing;
        }
        synchronized (lock) {
            if (this.decoder == null) {
                this.decoder = buildDecoder();
            }
            return this.decoder;
        }
    }

    private JwtDecoder buildDecoder() {
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder
                .withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();

        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                new JwtClaimValidator<String>(JwtClaimNames.ISS, ACCEPTED_ISSUERS::contains),
                // The token must have been minted for *our* OAuth client, otherwise a
                // token obtained by any other Google app would be accepted here.
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                        aud -> aud != null && aud.contains(clientId))
        );
        jwtDecoder.setJwtValidator(validator);
        return jwtDecoder;
    }
}
