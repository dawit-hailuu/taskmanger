package com.taskmanager.auth;

import com.taskmanager.auth.dto.AuthResponse;
import com.taskmanager.auth.dto.EmailRequest;
import com.taskmanager.auth.dto.LoginRequest;
import com.taskmanager.auth.dto.MessageResponse;
import com.taskmanager.auth.dto.RefreshRequest;
import com.taskmanager.auth.dto.RegisterRequest;
import com.taskmanager.auth.dto.ResetPasswordRequest;
import com.taskmanager.auth.service.EmailVerificationService;
import com.taskmanager.auth.service.PasswordResetService;
import com.taskmanager.auth.support.ClientInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Registration, login, tokens, and account recovery")
public class AuthController {

    private static final String GENERIC_EMAIL_MESSAGE =
            "If an account with that email exists, we've sent it an email.";

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService,
                          EmailVerificationService emailVerificationService,
                          PasswordResetService passwordResetService) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
        this.passwordResetService = passwordResetService;
    }

    @Operation(summary = "Register a new account and send a verification email")
    @PostMapping("/register")
    public ResponseEntity<MessageResponse> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new MessageResponse(
                "Registration successful. Please check your email to verify your account."));
    }

    @Operation(summary = "Authenticate and receive access + refresh tokens")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletRequest http) {
        return ResponseEntity.ok(authService.login(request, ClientInfo.from(http)));
    }

    @Operation(summary = "Exchange a refresh token for a new token pair (rotates the refresh token)")
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request,
                                                HttpServletRequest http) {
        return ResponseEntity.ok(authService.refresh(request.refreshToken(), ClientInfo.from(http)));
    }

    @Operation(summary = "Revoke a refresh token (sign out)")
    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.ok(new MessageResponse("Signed out."));
    }

    @Operation(summary = "Confirm an email address using the token from the verification email")
    @GetMapping("/verify-email")
    public ResponseEntity<MessageResponse> verifyEmail(@RequestParam("token") String token) {
        emailVerificationService.verify(token);
        return ResponseEntity.ok(new MessageResponse("Email verified. You can now sign in."));
    }

    @Operation(summary = "Resend the email verification link")
    @PostMapping("/resend-verification")
    public ResponseEntity<MessageResponse> resendVerification(@Valid @RequestBody EmailRequest request) {
        authService.resendVerification(request.email());
        return ResponseEntity.ok(new MessageResponse(GENERIC_EMAIL_MESSAGE));
    }

    @Operation(summary = "Request a password-reset email")
    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody EmailRequest request) {
        passwordResetService.requestReset(request.email());
        return ResponseEntity.ok(new MessageResponse(GENERIC_EMAIL_MESSAGE));
    }

    @Operation(summary = "Set a new password using a reset token")
    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.reset(request.token(), request.newPassword());
        return ResponseEntity.ok(new MessageResponse("Password updated. You can now sign in."));
    }
}
