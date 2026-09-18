package com.taskmanager.auth.google;

import com.taskmanager.exception.EmailAlreadyExistsException;
import com.taskmanager.profile.ProfileService;
import com.taskmanager.profile.UserActivityService;
import com.taskmanager.profile.UserActivityType;
import com.taskmanager.user.AccountStatus;
import com.taskmanager.user.AuthProvider;
import com.taskmanager.user.Role;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import com.taskmanager.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Maps a verified {@link GoogleAccount} onto a local {@link User} — linking an
 * existing account or provisioning a new one.
 *
 * <p>Lives in its own bean (rather than inside {@code AuthService}) so the
 * {@code @Transactional} boundary is a real proxy boundary: provisioning writes
 * a user, a profile, preferences and a personal workspace, and those must commit
 * or roll back together. A self-invoked method on AuthService would silently
 * bypass the proxy and lose that guarantee.
 */
@Service
public class GoogleAccountService {

    /** Truncation guard for the avatar URL column (VARCHAR(500)). */
    private static final int MAX_AVATAR_URL_LENGTH = 500;

    private final UserRepository userRepository;
    private final ProfileService profileService;
    private final WorkspaceService workspaceService;
    private final UserActivityService userActivityService;

    public GoogleAccountService(UserRepository userRepository,
                                ProfileService profileService,
                                WorkspaceService workspaceService,
                                UserActivityService userActivityService) {
        this.userRepository = userRepository;
        this.profileService = profileService;
        this.workspaceService = workspaceService;
        this.userActivityService = userActivityService;
    }

    /**
     * Resolution order — Google's immutable subject id first, then email:
     * <ol>
     *   <li>a previously linked account, or</li>
     *   <li>an existing account with the same email, which gets linked, or</li>
     *   <li>a brand-new account, provisioned on the spot.</li>
     * </ol>
     */
    @Transactional
    public User resolve(GoogleAccount account) {
        return userRepository.findByProviderId(account.subject())
                .or(() -> userRepository.findByEmail(account.email()))
                .map(existing -> link(existing, account))
                .orElseGet(() -> provision(account));
    }

    /**
     * Attaches the Google identity to an account that already exists locally.
     *
     * <p>An account that also has a local password keeps it — we only record the
     * Google subject so later sign-ins resolve directly. Because Google has
     * confirmed ownership of the address, a still-pending account is promoted to
     * verified here: that confirmation is exactly what the emailed link proves.
     */
    private User link(User user, GoogleAccount account) {
        boolean dirty = false;

        if (user.getProviderId() == null) {
            user.setProviderId(account.subject());
            dirty = true;
        }
        if (!user.isEmailVerified()) {
            user.setEmailVerified(true);
            dirty = true;
        }
        if (user.getAccountStatus() == AccountStatus.PENDING) {
            user.setAccountStatus(AccountStatus.ACTIVE);
            dirty = true;
        }
        return dirty ? userRepository.save(user) : user;
    }

    /** Creates a fresh, already-verified account for a first-time Google user. */
    private User provision(GoogleAccount account) {
        if (userRepository.existsByEmail(account.email())) {
            // Only reachable if a concurrent request won the race; surface it cleanly.
            throw new EmailAlreadyExistsException("Email is already registered: " + account.email());
        }

        User user = User.builder()
                .name(account.displayName())
                .email(account.email())
                // No local password: this account authenticates through Google only.
                .password(null)
                .role(Role.ROLE_USER)
                .authProvider(AuthProvider.GOOGLE)
                .providerId(account.subject())
                // Google already proved the address, so no verification email is needed.
                .accountStatus(AccountStatus.ACTIVE)
                .emailVerified(true)
                .build();

        User saved = userRepository.save(user);
        profileService.createDefaults(saved, truncate(account.pictureUrl()));
        workspaceService.createPersonalWorkspace(saved);
        userActivityService.log(saved, UserActivityType.ACCOUNT_CREATED, "Account created via Google Sign-In");
        return saved;
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= MAX_AVATAR_URL_LENGTH ? value : value.substring(0, MAX_AVATAR_URL_LENGTH);
    }
}
