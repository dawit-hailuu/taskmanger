package com.taskmanager.task.model;

import com.taskmanager.task.Task;
import com.taskmanager.user.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "task_watchers",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_task_watchers_task_user", columnNames = {"task_id", "user_id"})
)
public class TaskWatcher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_watchers_task"))
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_watchers_user"))
    private User user;

    @Column(name = "watched_at", nullable = false, updatable = false)
    private Instant watchedAt;

    public TaskWatcher() {
    }

    public TaskWatcher(Task task, User user) {
        this.task = task;
        this.user = user;
        this.watchedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public User getUser() { return user; }
    public Instant getWatchedAt() { return watchedAt; }
}
