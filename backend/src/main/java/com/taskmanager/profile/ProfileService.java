package com.taskmanager.profile;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.profile.dto.NotificationPreferencesResponse;
import com.taskmanager.profile.dto.ProfileResponse;
import com.taskmanager.profile.dto.UpdateNotificationPreferencesRequest;
import com.taskmanager.profile.dto.UpdateProfileRequest;
import com.taskmanager.storage.StorageService;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Set;

@Service
public class ProfileService {

    private static final String AVATAR_SUBFOLDER = "avatars";
    private static final Set<String> ALLOWED_AVATAR_TYPES =
            Set.of("image/png", "image/jpeg", "image/webp", "image/gif");

    private final UserProfileRepository profileRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final UserActivityService activityService;

    public ProfileService(UserProfileRepository profileRepository,
                          NotificationPreferenceRepository preferenceRepository,
                          UserRepository userRepository,
                          StorageService storageService,
                          UserActivityService activityService) {
        this.profileRepository = profileRepository;
        this.preferenceRepository = preferenceRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.activityService = activityService;
    }

    /** Creates the default profile + notification preference rows for a newly registered user. */
    @Transactional
    public void createDefaults(User user) {
        UserProfile profile = new UserProfile();
        profile.setUser(user);
        profileRepository.save(profile);

        NotificationPreference preference = new NotificationPreference();
        preference.setUser(user);
        preferenceRepository.save(preference);
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(User user) {
        return ProfileResponse.from(user, getOrCreateProfile(user));
    }

    @Transactional
    public ProfileResponse updateProfile(User user, UpdateProfileRequest request) {
        validateTimezone(request.timezone());

        user.setName(request.name());
        userRepository.save(user);

        UserProfile profile = getOrCreateProfile(user);
        profile.setBio(blankToNull(request.bio()));
        profile.setPhone(blankToNull(request.phone()));
        profile.setTimezone(request.timezone());
        profileRepository.save(profile);

        activityService.log(user, UserActivityType.PROFILE_UPDATED, "Profile details updated");
        return ProfileResponse.from(user, profile);
    }

    @Transactional
    public ProfileResponse uploadAvatar(User user, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was provided.");
        }
        if (!ALLOWED_AVATAR_TYPES.contains(file.getContentType())) {
            throw new BadRequestException("Only PNG, JPEG, WEBP, or GIF images are allowed.");
        }

        UserProfile profile = getOrCreateProfile(user);
        String previousAvatar = profile.getAvatarUrl();

        String newUrl = storageService.store(file, AVATAR_SUBFOLDER);
        profile.setAvatarUrl(newUrl);
        profileRepository.save(profile);

        if (previousAvatar != null) {
            storageService.delete(previousAvatar);
        }

        activityService.log(user, UserActivityType.AVATAR_UPDATED, "Profile picture updated");
        return ProfileResponse.from(user, profile);
    }

    @Transactional
    public ProfileResponse removeAvatar(User user) {
        UserProfile profile = getOrCreateProfile(user);
        if (profile.getAvatarUrl() != null) {
            storageService.delete(profile.getAvatarUrl());
            profile.setAvatarUrl(null);
            profileRepository.save(profile);
            activityService.log(user, UserActivityType.AVATAR_REMOVED, "Profile picture removed");
        }
        return ProfileResponse.from(user, profile);
    }

    @Transactional(readOnly = true)
    public NotificationPreferencesResponse getNotificationPreferences(User user) {
        return NotificationPreferencesResponse.from(getOrCreatePreference(user));
    }

    @Transactional
    public NotificationPreferencesResponse updateNotificationPreferences(
            User user, UpdateNotificationPreferencesRequest request) {
        NotificationPreference p = getOrCreatePreference(user);
        p.setEmailTaskAssigned(request.emailTaskAssigned());
        p.setEmailDeadlineApproaching(request.emailDeadlineApproaching());
        p.setEmailComment(request.emailComment());
        p.setEmailMention(request.emailMention());
        p.setEmailStatusChange(request.emailStatusChange());
        p.setEmailProjectInvite(request.emailProjectInvite());
        p.setInAppTaskAssigned(request.inAppTaskAssigned());
        p.setInAppDeadlineApproaching(request.inAppDeadlineApproaching());
        p.setInAppComment(request.inAppComment());
        p.setInAppMention(request.inAppMention());
        p.setInAppStatusChange(request.inAppStatusChange());
        p.setInAppProjectInvite(request.inAppProjectInvite());
        preferenceRepository.save(p);

        activityService.log(user, UserActivityType.NOTIFICATION_PREFERENCES_UPDATED,
                "Notification preferences updated");
        return NotificationPreferencesResponse.from(p);
    }

    @Transactional(readOnly = true)
    public Page<UserActivity> getActivity(User user, Pageable pageable) {
        return activityService.history(user, pageable);
    }

    // ---- helpers ----

    /** Defensive fallback: creates the row on first access if it's somehow missing. */
    private UserProfile getOrCreateProfile(User user) {
        return profileRepository.findByUser(user).orElseGet(() -> {
            UserProfile profile = new UserProfile();
            profile.setUser(user);
            return profileRepository.save(profile);
        });
    }

    private NotificationPreference getOrCreatePreference(User user) {
        return preferenceRepository.findByUser(user).orElseGet(() -> {
            NotificationPreference preference = new NotificationPreference();
            preference.setUser(user);
            return preferenceRepository.save(preference);
        });
    }

    private void validateTimezone(String timezone) {
        try {
            ZoneId.of(timezone);
        } catch (DateTimeException ex) {
            throw new BadRequestException("'" + timezone + "' is not a recognized timezone.");
        }
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
