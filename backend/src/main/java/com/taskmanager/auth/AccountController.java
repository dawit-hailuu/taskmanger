package com.taskmanager.auth;

import com.taskmanager.auth.dto.ChangePasswordRequest;
import com.taskmanager.auth.dto.LoginHistoryResponse;
import com.taskmanager.auth.dto.MessageResponse;
import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Authenticated self-service endpoints for the current user's account. */
@RestController
@RequestMapping("/api/account")
@Tag(name = "Account", description = "Authenticated self-service: password and login history")
public class AccountController {

    private final AuthService authService;

    public AccountController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Change the current user's password (revokes other sessions)")
    @PostMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(@AuthenticationPrincipal User user,
                                                          @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(user, request);
        return ResponseEntity.ok(new MessageResponse(
                "Password changed. Please sign in again on your other devices."));
    }

    @Operation(summary = "List the current user's recent login attempts")
    @GetMapping("/login-history")
    public ResponseEntity<PageResponse<LoginHistoryResponse>> loginHistory(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<com.taskmanager.auth.model.LoginHistory> result = authService.loginHistory(user, pageable);
        return ResponseEntity.ok(PageResponse.from(result, LoginHistoryResponse::from));
    }
}
