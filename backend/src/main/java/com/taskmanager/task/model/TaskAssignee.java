package com.taskmanager.task.model;

import com.taskmanager.task.Task;
import com.taskmanager.user.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "task_assignees",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_task_assignees_task_user", columnNames = {"task_id", "user_id"})
)
public class TaskAssignee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_assignees_task"))
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_assignees_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_by", nullable = false, foreignKey = @ForeignKey(name = "fk_task_assignees_assigned_by"))
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;

    public TaskAssignee() {
    }

    public TaskAssignee(Task task, User user, User assignedBy) {
        this.task = task;
        this.user = user;
        this.assignedBy = assignedBy;
        this.assignedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public User getUser() { return user; }
    public User getAssignedBy() { return assignedBy; }
    public Instant getAssignedAt() { return assignedAt; }
}
