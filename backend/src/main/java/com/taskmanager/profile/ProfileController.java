package com.taskmanager.profile;

import com.taskmanager.profile.dto.NotificationPreferencesResponse;
import com.taskmanager.profile.dto.ProfileResponse;
import com.taskmanager.profile.dto.UpdateNotificationPreferencesRequest;
import com.taskmanager.profile.dto.UpdateProfileRequest;
import com.taskmanager.profile.dto.UserActivityResponse;
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
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/profile")
@Tag(name = "Profile", description = "The current user's profile, avatar, notification preferences, and activity history")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @Operation(summary = "Get the current user's profile")
    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(profileService.getProfile(user));
    }

    @Operation(summary = "Update the current user's name, bio, phone, and timezone")
    @PutMapping
    public ResponseEntity<ProfileResponse> updateProfile(@AuthenticationPrincipal User user,
                                                         @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateProfile(user, request));
    }

    @Operation(summary = "Upload a new profile picture (PNG, JPEG, WEBP, or GIF, up to 3MB)")
    @PostMapping(value = "/avatar", consumes = "multipart/form-data")
    public ResponseEntity<ProfileResponse> uploadAvatar(@AuthenticationPrincipal User user,
                                                        @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(profileService.uploadAvatar(user, file));
    }

    @Operation(summary = "Remove the current profile picture")
    @DeleteMapping("/avatar")
    public ResponseEntity<ProfileResponse> removeAvatar(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(profileService.removeAvatar(user));
    }

    @Operation(summary = "Get the current user's notification preferences")
    @GetMapping("/notifications")
    public ResponseEntity<NotificationPreferencesResponse> getNotificationPreferences(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(profileService.getNotificationPreferences(user));
    }

    @Operation(summary = "Replace the current user's notification preferences")
    @PutMapping("/notifications")
    public ResponseEntity<NotificationPreferencesResponse> updateNotificationPreferences(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateNotificationPreferencesRequest request) {
        return ResponseEntity.ok(profileService.updateNotificationPreferences(user, request));
    }

    @Operation(summary = "List the current user's account activity history")
    @GetMapping("/activity")
    public ResponseEntity<PageResponse<UserActivityResponse>> getActivity(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<UserActivity> result = profileService.getActivity(user, pageable);
        return ResponseEntity.ok(PageResponse.from(result, UserActivityResponse::from));
    }
}
