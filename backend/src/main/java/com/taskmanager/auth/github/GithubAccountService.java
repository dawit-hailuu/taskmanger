package com.taskmanager.auth.github;

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
 * Maps a verified {@link GithubAccount} onto a local {@link User} — linking an
 * existing account or provisioning a new one. Mirrors {@code GoogleAccountService}
 * exactly; the two aren't unified into one generic service because the day a
 * third provider's account shape stops looking like these two, a forced shared
 * abstraction would be the wrong call anyway.
 */
@Service
public class GithubAccountService {

    private static final int MAX_AVATAR_URL_LENGTH = 500;

    private final UserRepository userRepository;
    private final ProfileService profileService;
    private final WorkspaceService workspaceService;
    private final UserActivityService userActivityService;

    public GithubAccountService(UserRepository userRepository,
                                ProfileService profileService,
                                WorkspaceService workspaceService,
                                UserActivityService userActivityService) {
        this.userRepository = userRepository;
        this.profileService = profileService;
        this.workspaceService = workspaceService;
        this.userActivityService = userActivityService;
    }

    /**
     * Resolution order — GitHub's immutable numeric id first, then email:
     * <ol>
     *   <li>a previously linked account, or</li>
     *   <li>an existing account with the same email, which gets linked, or</li>
     *   <li>a brand-new account, provisioned on the spot.</li>
     * </ol>
     */
    @Transactional
    public User resolve(GithubAccount account) {
        String providerId = String.valueOf(account.id());
        return userRepository.findByAuthProviderAndProviderId(AuthProvider.GITHUB, providerId)
                .or(() -> userRepository.findByEmail(account.email()))
                .map(existing -> link(existing, account))
                .orElseGet(() -> provision(account));
    }

    /** Attaches the GitHub identity to an account that already exists locally. */
    private User link(User user, GithubAccount account) {
        boolean dirty = false;

        if (user.getProviderId() == null) {
            user.setProviderId(String.valueOf(account.id()));
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

    /** Creates a fresh, already-verified account for a first-time GitHub user. */
    private User provision(GithubAccount account) {
        if (userRepository.existsByEmail(account.email())) {
            // Only reachable if a concurrent request won the race; surface it cleanly.
            throw new EmailAlreadyExistsException("Email is already registered: " + account.email());
        }

        User user = User.builder()
                .name(account.displayName())
                .email(account.email())
                // No local password: this account authenticates through GitHub only.
                .password(null)
                .role(Role.ROLE_USER)
                .authProvider(AuthProvider.GITHUB)
                .providerId(String.valueOf(account.id()))
                // GitHub only returns emails it has already verified.
                .accountStatus(AccountStatus.ACTIVE)
                .emailVerified(true)
                .build();

        User saved = userRepository.save(user);
        profileService.createDefaults(saved, truncate(account.avatarUrl()));
        workspaceService.createPersonalWorkspace(saved);
        userActivityService.log(saved, UserActivityType.ACCOUNT_CREATED, "Account created via GitHub Sign-In");
        return saved;
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= MAX_AVATAR_URL_LENGTH ? value : value.substring(0, MAX_AVATAR_URL_LENGTH);
    }
}
