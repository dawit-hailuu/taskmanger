package com.taskmanager.user;

import com.taskmanager.auth.dto.UserResponse;
import com.taskmanager.task.dto.PageResponse;
import com.taskmanager.user.dto.UserSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "Current user profile and admin user management")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "Get the currently authenticated user")
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @Operation(summary = "List all users (admin only)")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<PageResponse<UserSummary>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<User> result = userService.list(pageable);
        return ResponseEntity.ok(PageResponse.from(result, UserSummary::from));
    }

    @Operation(summary = "Activate a user account (admin only)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/activate")
    public ResponseEntity<UserSummary> activate(@PathVariable Long id,
                                                @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(UserSummary.from(userService.setEnabled(id, true, admin)));
    }

    @Operation(summary = "Deactivate a user account (admin only)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<UserSummary> deactivate(@PathVariable Long id,
                                                  @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(UserSummary.from(userService.setEnabled(id, false, admin)));
    }
}
