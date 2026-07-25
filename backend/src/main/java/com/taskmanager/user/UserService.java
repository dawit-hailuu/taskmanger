package com.taskmanager.user;

import com.taskmanager.auth.service.RefreshTokenService;
import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RefreshTokenService refreshTokenService;

    public UserService(UserRepository userRepository, RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional(readOnly = true)
    public Page<User> list(Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    @Transactional
    public User setEnabled(Long userId, boolean enabled, User actingAdmin) {
        if (!enabled && userId.equals(actingAdmin.getId())) {
            throw new BadRequestException("You cannot deactivate your own account.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + userId));
        user.setAccountStatus(enabled ? AccountStatus.ACTIVE : AccountStatus.DEACTIVATED);
        userRepository.save(user);

        // A deactivated user's existing sessions must stop working.
        if (!enabled) {
            refreshTokenService.revokeAllForUser(user);
        }
        return user;
    }
}
