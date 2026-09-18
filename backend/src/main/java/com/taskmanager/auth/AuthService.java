package com.taskmanager.auth;

import com.taskmanager.auth.dto.AuthResponse;
import com.taskmanager.auth.dto.ChangePasswordRequest;
import com.taskmanager.auth.dto.GithubLoginRequest;
import com.taskmanager.auth.dto.GoogleCodeLoginRequest;
import com.taskmanager.auth.dto.GoogleLoginRequest;
import com.taskmanager.auth.dto.LoginRequest;
import com.taskmanager.auth.dto.RegisterRequest;
import com.taskmanager.auth.github.GithubAccount;
import com.taskmanager.auth.github.GithubAccountService;
import com.taskmanager.auth.github.GithubOAuthClient;
import com.taskmanager.auth.google.GoogleAccount;
import com.taskmanager.auth.google.GoogleAccountService;
import com.taskmanager.auth.google.GoogleOAuthClient;
import com.taskmanager.auth.google.GoogleTokenVerifier;
import com.taskmanager.auth.model.LoginHistory;
import com.taskmanager.auth.repository.LoginHistoryRepository;
import com.taskmanager.auth.service.EmailVerificationService;
import com.taskmanager.auth.service.RefreshTokenService;
import com.taskmanager.auth.support.ClientInfo;
import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.EmailAlreadyExistsException;
import com.taskmanager.exception.EmailNotVerifiedException;
import com.taskmanager.exception.InvalidTokenException;
import com.taskmanager.mail.EmailService;
import com.taskmanager.profile.ProfileService;
import com.taskmanager.profile.UserActivityService;
import com.taskmanager.profile.UserActivityType;
import com.taskmanager.security.JwtService;
import com.taskmanager.user.AccountStatus;
import com.taskmanager.user.Role;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import com.taskmanager.workspace.WorkspaceService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;
    private final EmailVerificationService emailVerificationService;
    private final LoginHistoryRepository loginHistoryRepository;
    private final EmailService emailService;
    private final ProfileService profileService;
    private final UserActivityService userActivityService;
    private final WorkspaceService workspaceService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final GoogleAccountService googleAccountService;
    private final GoogleOAuthClient googleOAuthClient;
    private final GithubOAuthClient githubOAuthClient;
    private final GithubAccountService githubAccountService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtService jwtService, AuthenticationManager authenticationManager,
                       RefreshTokenService refreshTokenService,
                       EmailVerificationService emailVerificationService,
                       LoginHistoryRepository loginHistoryRepository,
                       EmailService emailService,
                       ProfileService profileService,
                       UserActivityService userActivityService,
                       WorkspaceService workspaceService,
                       GoogleTokenVerifier googleTokenVerifier,
                       GoogleAccountService googleAccountService,
                       GoogleOAuthClient googleOAuthClient,
                       GithubOAuthClient githubOAuthClient,
                       GithubAccountService githubAccountService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.refreshTokenService = refreshTokenService;
        this.emailVerificationService = emailVerificationService;
        this.loginHistoryRepository = loginHistoryRepository;
        this.emailService = emailService;
        this.profileService = profileService;
        this.userActivityService = userActivityService;
        this.workspaceService = workspaceService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.googleAccountService = googleAccountService;
        this.googleOAuthClient = googleOAuthClient;
        this.githubOAuthClient = githubOAuthClient;
        this.githubAccountService = githubAccountService;
    }

    /** Create an unverified account and dispatch a verification email. */
    @Transactional
    public void register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException("Email is already registered: " + request.email());
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(Role.ROLE_USER)
                .accountStatus(AccountStatus.PENDING)
                .emailVerified(false)
                .build();

        User saved = userRepository.save(user);
        profileService.createDefaults(saved);
        workspaceService.createPersonalWorkspace(saved);
        userActivityService.log(saved, UserActivityType.ACCOUNT_CREATED, "Account created");
        emailVerificationService.createAndSend(saved);
    }

    /**
     * Authenticate, enforce email verification, record the attempt, and issue
     * an access + refresh token pair. Intentionally not wrapped in a single
     * transaction so failed-attempt audit rows survive the thrown exception.
     */
    public AuthResponse login(LoginRequest request, ClientInfo client) {
        User user = userRepository.findByEmail(request.email()).orElse(null);

        // A federated account has no local hash, so password auth could only ever
        // fail here. Say so explicitly instead of "invalid email or password".
        if (user != null && !user.hasLocalPassword()) {
            recordFailure(user, request.email(), "WRONG_AUTH_PROVIDER", client);
            throw new BadRequestException("This account signs in with "
                    + user.getAuthProvider().displayName() + ". Use that option instead.");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password()));
            user = (User) authentication.getPrincipal();
        } catch (BadCredentialsException ex) {
            recordFailure(user, request.email(), "BAD_CREDENTIALS", client);
            throw ex;
        } catch (DisabledException ex) {
            recordFailure(user, request.email(), "ACCOUNT_DISABLED", client);
            throw ex;
        }

        if (!user.isEmailVerified()) {
            recordFailure(user, request.email(), "EMAIL_NOT_VERIFIED", client);
            throw new EmailNotVerifiedException(
                    "Please verify your email before signing in. Check your inbox or request a new link.");
        }

        return issueSession(user, request.rememberMe(), client);
    }

    /**
     * "Continue with Google".
     *
     * <p>Verifies the Google ID token, then resolves it to an account:
     * <ol>
     *   <li>a previously linked account (matched on Google's immutable subject id), or</li>
     *   <li>an existing account with the same email — which gets linked and signed in, or</li>
     *   <li>a brand-new account, provisioned on the spot.</li>
     * </ol>
     *
     * <p>The end of the flow is deliberately identical to password login: the same
     * refresh-token issuance, the same JWT access token, the same login-history row.
     * Nothing downstream can tell how the user authenticated.
     */
    public AuthResponse loginWithGoogle(GoogleLoginRequest request, ClientInfo client) {
        GoogleAccount account = googleTokenVerifier.verify(request.credential());

        if (!account.emailVerified()) {
            throw new InvalidTokenException(
                    "Google has not verified this account's email address, so we can't sign you in with it.");
        }

        User user = googleAccountService.resolve(account);

        if (user.getAccountStatus() == AccountStatus.DEACTIVATED) {
            recordFailure(user, account.email(), "ACCOUNT_DISABLED", client);
            throw new DisabledException("This account has been deactivated.");
        }

        return issueSession(user, request.rememberMe(), client);
    }

    /**
     * "Continue with Google" via the custom-button popup flow — what the frontend
     * actually calls now. Same account resolution and session issuance as
     * {@link #loginWithGoogle}; the only difference is {@link GoogleOAuthClient}
     * exchanges an authorization code for the ID token first, since the browser
     * never had one directly.
     */
    public AuthResponse loginWithGoogleCode(GoogleCodeLoginRequest request, ClientInfo client) {
        GoogleAccount account = googleOAuthClient.exchange(request.code());

        if (!account.emailVerified()) {
            throw new InvalidTokenException(
                    "Google has not verified this account's email address, so we can't sign you in with it.");
        }

        User user = googleAccountService.resolve(account);

        if (user.getAccountStatus() == AccountStatus.DEACTIVATED) {
            recordFailure(user, account.email(), "ACCOUNT_DISABLED", client);
            throw new DisabledException("This account has been deactivated.");
        }

        return issueSession(user, request.rememberMe(), client);
    }

    /**
     * "Continue with GitHub" — same shape as {@link #loginWithGoogle}, but GitHub's
     * OAuth is an authorization-code exchange rather than a client-side ID token, so
     * the exchange (which needs the client secret) happens in
     * {@link GithubOAuthClient} before resolution even starts.
     */
    public AuthResponse loginWithGithub(GithubLoginRequest request, ClientInfo client) {
        GithubAccount account = githubOAuthClient.exchange(request.code(), request.redirectUri());

        User user = githubAccountService.resolve(account);

        if (user.getAccountStatus() == AccountStatus.DEACTIVATED) {
            recordFailure(user, account.email(), "ACCOUNT_DISABLED", client);
            throw new DisabledException("This account has been deactivated.");
        }

        return issueSession(user, request.rememberMe(), client);
    }

    /**
     * Common tail of every successful sign-in path (local, Google, GitHub): stamp
     * {@code lastLoginAt}, record the login-history row, and issue a fresh
     * access + refresh token pair. Nothing downstream of this can tell which path
     * the caller came from.
     */
    private AuthResponse issueSession(User user, boolean rememberMe, ClientInfo client) {
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        loginHistoryRepository.save(LoginHistory.success(user, client.ipAddress(), client.userAgent()));

        String refreshToken = refreshTokenService.issue(user, rememberMe, client.ipAddress(), client.userAgent());
        String accessToken = jwtService.generateAccessToken(user);
        return AuthResponse.of(accessToken, refreshToken, jwtService.getAccessExpirationMs(), user);
    }

    /** Rotate the refresh token and mint a fresh access token. */
    public AuthResponse refresh(String rawRefreshToken, ClientInfo client) {
        RefreshTokenService.IssuedToken rotated =
                refreshTokenService.rotate(rawRefreshToken, client.ipAddress(), client.userAgent());
        String accessToken = jwtService.generateAccessToken(rotated.user());
        return AuthResponse.of(accessToken, rotated.rawToken(),
                jwtService.getAccessExpirationMs(), rotated.user());
    }

    public void logout(String rawRefreshToken) {
        refreshTokenService.revoke(rawRefreshToken);
    }

    /** Re-send a verification email if the account exists and is still unverified. */
    @Transactional
    public void resendVerification(String email) {
        userRepository.findByEmail(email)
                .filter(u -> !u.isEmailVerified())
                .ifPresent(emailVerificationService::createAndSend);
    }

    @Transactional
    public void changePassword(User user, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BadRequestException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // Invalidate every existing session; the current client re-authenticates.
        refreshTokenService.revokeAllForUser(user);
        emailService.sendPasswordChangedEmail(user);
        userActivityService.log(user, UserActivityType.PASSWORD_CHANGED, "Password changed");
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<LoginHistory> loginHistory(
            User user, org.springframework.data.domain.Pageable pageable) {
        return loginHistoryRepository.findByUserOrderByCreatedAtDesc(user, pageable);
    }

    private void recordFailure(User user, String email, String reason, ClientInfo client) {
        loginHistoryRepository.save(
                LoginHistory.failure(user, email, reason, client.ipAddress(), client.userAgent()));
    }
}
