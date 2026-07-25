package com.taskmanager.task.model;

import com.taskmanager.task.Task;
import com.taskmanager.user.User;
import jakarta.persistence.*;

import java.time.Instant;

/** Records that {@code task} cannot proceed until {@code dependsOn} is done. */
@Entity
@Table(
        name = "task_dependencies",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_task_dependencies_task_depends_on", columnNames = {"task_id", "depends_on_task_id"})
)
public class TaskDependency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The blocked/dependent task. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_dependencies_task"))
    private Task task;

    /** The blocking task, which must complete first. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "depends_on_task_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_task_dependencies_depends_on"))
    private Task dependsOn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, foreignKey = @ForeignKey(name = "fk_task_dependencies_created_by"))
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public TaskDependency() {
    }

    public TaskDependency(Task task, Task dependsOn, User createdBy) {
        this.task = task;
        this.dependsOn = dependsOn;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public Task getDependsOn() { return dependsOn; }
    public User getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
