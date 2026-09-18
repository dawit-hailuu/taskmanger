package com.taskmanager.auth.github;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.InvalidTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

/**
 * Exchanges a GitHub authorization code for an access token, then resolves the
 * profile it belongs to. Unlike Google's Identity Services flow (a client-side
 * ID token the backend only needs to verify), GitHub's OAuth is the classic
 * server-side Authorization Code flow: the client secret used in the exchange
 * must never reach the browser, so both HTTP calls happen here.
 *
 * <p>The client is built once, lazily, on first use — so the application still
 * starts (with GitHub sign-in simply unavailable) when no client id/secret is
 * configured, exactly like {@code GoogleTokenVerifier}.
 */
@Component
public class GithubOAuthClient {

    private static final Logger log = LoggerFactory.getLogger(GithubOAuthClient.class);

    private static final String TOKEN_URL = "https://github.com/login/oauth/access_token";
    private static final String USER_URL = "https://api.github.com/user";
    private static final String EMAILS_URL = "https://api.github.com/user/emails";

    private final String clientId;
    private final String clientSecret;
    private final RestClient restClient;

    public GithubOAuthClient(
            @Value("${app.oauth2.github.client-id:}") String clientId,
            @Value("${app.oauth2.github.client-secret:}") String clientSecret) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
        this.restClient = RestClient.create();
    }

    /** Whether the deployment is configured to accept GitHub sign-in at all. */
    public boolean isEnabled() {
        return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
    }

    /** The public OAuth client id the browser builds the authorize URL with, or {@code null}. */
    public String clientId() {
        return isEnabled() ? clientId : null;
    }

    /**
     * @param code        the authorization code GitHub redirected back with
     * @param redirectUri must match the one used to obtain {@code code}; GitHub
     *                    validates this itself
     * @throws BadRequestException   when GitHub sign-in is not configured on this deployment
     * @throws InvalidTokenException when the code is invalid/expired, or the resulting
     *                               account has no verified email GitHub will vouch for
     */
    public GithubAccount exchange(String code, String redirectUri) {
        if (!isEnabled()) {
            throw new BadRequestException(
                    "GitHub Sign-In is not configured on this server. Use email and password instead.");
        }
        if (!StringUtils.hasText(code)) {
            throw new InvalidTokenException("Missing GitHub authorization code.");
        }

        String accessToken = requestAccessToken(code, redirectUri);
        GithubUser user = fetchUser(accessToken);
        String email = user.email() != null ? user.email() : fetchPrimaryVerifiedEmail(accessToken);

        if (!StringUtils.hasText(email)) {
            throw new InvalidTokenException(
                    "This GitHub account has no verified email address we can sign you in with.");
        }

        return new GithubAccount(user.id(), user.login(), email.toLowerCase(), user.name(), user.avatarUrl());
    }

    private String requestAccessToken(String code, String redirectUri) {
        TokenResponse response;
        try {
            response = restClient.post()
                    .uri(TOKEN_URL)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .body(new TokenRequest(clientId, clientSecret, code, redirectUri))
                    .retrieve()
                    .body(TokenResponse.class);
        } catch (RestClientException ex) {
            log.warn("GitHub token exchange failed: {}", ex.getMessage());
            throw new InvalidTokenException("That GitHub sign-in could not be verified. Please try again.");
        }

        if (response == null || !StringUtils.hasText(response.accessToken())) {
            log.warn("GitHub token exchange rejected the code: {}",
                    response != null ? response.errorDescription() : "empty response");
            throw new InvalidTokenException("That GitHub sign-in could not be verified. Please try again.");
        }
        return response.accessToken();
    }

    private GithubUser fetchUser(String accessToken) {
        try {
            GithubUser user = restClient.get()
                    .uri(USER_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .retrieve()
                    .body(GithubUser.class);
            if (user == null) {
                throw new InvalidTokenException("GitHub did not return a profile for that sign-in.");
            }
            return user;
        } catch (RestClientException ex) {
            log.warn("Fetching the GitHub profile failed: {}", ex.getMessage());
            throw new InvalidTokenException("That GitHub sign-in could not be verified. Please try again.");
        }
    }

    /** Only called when the profile itself has no public email — GitHub lets that be private. */
    private String fetchPrimaryVerifiedEmail(String accessToken) {
        try {
            List<GithubEmail> emails = restClient.get()
                    .uri(EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<GithubEmail>>() {});

            if (emails == null) {
                return null;
            }
            return emails.stream()
                    .filter(GithubEmail::verified)
                    .filter(GithubEmail::primary)
                    .findFirst()
                    .or(() -> emails.stream().filter(GithubEmail::verified).findFirst())
                    .map(GithubEmail::email)
                    .orElse(null);
        } catch (RestClientException ex) {
            log.warn("Fetching GitHub account emails failed: {}", ex.getMessage());
            return null;
        }
    }

    private record TokenRequest(
            @JsonProperty("client_id") String clientId,
            @JsonProperty("client_secret") String clientSecret,
            String code,
            @JsonProperty("redirect_uri") String redirectUri
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("error_description") String errorDescription
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record GithubUser(
            long id,
            String login,
            String name,
            String email,
            @JsonProperty("avatar_url") String avatarUrl
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record GithubEmail(
            String email,
            boolean primary,
            boolean verified
    ) {
    }
}
