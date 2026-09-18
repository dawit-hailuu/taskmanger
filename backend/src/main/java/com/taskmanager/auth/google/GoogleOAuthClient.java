package com.taskmanager.auth.google;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.InvalidTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Exchanges an authorization code — obtained by the browser via Google Identity
 * Services' {@code initCodeClient} popup flow — for the ID token it belongs to,
 * then hands that token to {@link GoogleTokenVerifier} for exactly the same
 * cryptographic verification the direct ID-token flow already relies on. No
 * second account-resolution path exists; this only ever produces a
 * {@link GoogleAccount} the same way {@code GoogleTokenVerifier.verify} does.
 *
 * <p>This is the officially supported way to have a fully custom "Continue
 * with Google" button: Google's rendered-button requirement applies to the
 * client-side ID-token/One Tap product, not the OAuth 2.0 authorization code
 * flow, which is designed to be triggered from any UI.
 *
 * <p>{@code redirect_uri} below is the literal string {@code "postmessage"} —
 * the sentinel Google's JS client library expects when the code came from its
 * own popup ({@code ux_mode: 'popup'}) rather than a real page redirect, so
 * there is no callback URL to register or manage here, unlike GitHub's flow.
 */
@Component
public class GoogleOAuthClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthClient.class);
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String JS_POPUP_REDIRECT_URI = "postmessage";

    private final String clientId;
    private final String clientSecret;
    private final GoogleTokenVerifier tokenVerifier;
    private final RestClient restClient;

    public GoogleOAuthClient(
            @Value("${app.oauth2.google.client-id:}") String clientId,
            @Value("${app.oauth2.google.client-secret:}") String clientSecret,
            GoogleTokenVerifier tokenVerifier) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
        this.tokenVerifier = tokenVerifier;
        this.restClient = RestClient.create();
    }

    /** Needs both id and secret — unlike the direct ID-token flow, which only needs the id. */
    public boolean isEnabled() {
        return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
    }

    /** The public OAuth client id the browser builds the code-client with, or {@code null}. */
    public String clientId() {
        return isEnabled() ? clientId : null;
    }

    /**
     * @throws BadRequestException   when this deployment hasn't set a Google client secret
     * @throws InvalidTokenException when the code is invalid/expired, or exchange succeeds
     *                               but returns no ID token to verify
     */
    public GoogleAccount exchange(String code) {
        if (!isEnabled()) {
            throw new BadRequestException(
                    "Google Sign-In is not configured on this server. Use email and password instead.");
        }
        if (!StringUtils.hasText(code)) {
            throw new InvalidTokenException("Missing Google authorization code.");
        }

        TokenResponse response;
        try {
            response = restClient.post()
                    .uri(TOKEN_URL)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .body(new TokenRequest(code, clientId, clientSecret, JS_POPUP_REDIRECT_URI, "authorization_code"))
                    .retrieve()
                    .body(TokenResponse.class);
        } catch (RestClientException ex) {
            log.warn("Google authorization code exchange failed: {}", ex.getMessage());
            throw new InvalidTokenException("That Google sign-in could not be verified. Please try again.");
        }

        if (response == null || !StringUtils.hasText(response.idToken())) {
            throw new InvalidTokenException("That Google sign-in could not be verified. Please try again.");
        }
        return tokenVerifier.verify(response.idToken());
    }

    private record TokenRequest(
            String code,
            @JsonProperty("client_id") String clientId,
            @JsonProperty("client_secret") String clientSecret,
            @JsonProperty("redirect_uri") String redirectUri,
            @JsonProperty("grant_type") String grantType
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenResponse(@JsonProperty("id_token") String idToken) {
    }
}
