package com.taskmanager.auth.repository;

import com.taskmanager.auth.model.LoginHistory;
import com.taskmanager.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {

    Page<LoginHistory> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);
}
