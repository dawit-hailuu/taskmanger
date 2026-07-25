package com.taskmanager.auth;

import com.taskmanager.auth.dto.AuthResponse;
import com.taskmanager.auth.dto.ChangePasswordRequest;
import com.taskmanager.auth.dto.LoginRequest;
import com.taskmanager.auth.dto.RegisterRequest;
import com.taskmanager.auth.model.LoginHistory;
import com.taskmanager.auth.repository.LoginHistoryRepository;
import com.taskmanager.auth.service.EmailVerificationService;
import com.taskmanager.auth.service.RefreshTokenService;
import com.taskmanager.auth.support.ClientInfo;
import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.EmailAlreadyExistsException;
import com.taskmanager.exception.EmailNotVerifiedException;
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

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtService jwtService, AuthenticationManager authenticationManager,
                       RefreshTokenService refreshTokenService,
                       EmailVerificationService emailVerificationService,
                       LoginHistoryRepository loginHistoryRepository,
                       EmailService emailService,
                       ProfileService profileService,
                       UserActivityService userActivityService,
                       WorkspaceService workspaceService) {
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

        loginHistoryRepository.save(LoginHistory.success(user, client.ipAddress(), client.userAgent()));

        String refreshToken = refreshTokenService.issue(user, request.rememberMe(),
                client.ipAddress(), client.userAgent());
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
