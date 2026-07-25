package com.taskmanager.task.model;

import com.taskmanager.task.Task;
import com.taskmanager.user.User;
import jakarta.persistence.*;

import java.time.Instant;

/** An immutable audit-trail entry describing a single change made to a task. */
@Entity
@Table(
        name = "task_history",
        indexes = {
                @Index(name = "idx_task_history_task", columnList = "task_id"),
                @Index(name = "idx_task_history_created", columnList = "created_at")
        }
)
public class TaskHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_history_task"))
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_history_actor"))
    private User actor;

    @Column(nullable = false, length = 255)
    private String summary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public TaskHistory() {
    }

    public TaskHistory(Task task, User actor, String summary) {
        this.task = task;
        this.actor = actor;
        this.summary = summary;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public User getActor() { return actor; }
    public String getSummary() { return summary; }
    public Instant getCreatedAt() { return createdAt; }
}
