package com.taskmanager.profile;

import com.taskmanager.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Records and retrieves a user's account activity history. */
@Service
public class UserActivityService {

    private final UserActivityRepository repository;

    public UserActivityService(UserActivityRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(User user, UserActivityType type, String description) {
        repository.save(new UserActivity(user, type, description));
    }

    @Transactional(readOnly = true)
    public Page<UserActivity> history(User user, Pageable pageable) {
        return repository.findByUserOrderByCreatedAtDesc(user, pageable);
    }
}
