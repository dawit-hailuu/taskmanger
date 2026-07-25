package com.taskmanager.task.model;

import com.taskmanager.tag.Tag;
import com.taskmanager.task.Task;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "task_tags",
        uniqueConstraints = @UniqueConstraint(name = "uk_task_tags_task_tag", columnNames = {"task_id", "tag_id"})
)
public class TaskTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_tags_task"))
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false, foreignKey = @ForeignKey(name = "fk_task_tags_tag"))
    private Tag tag;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    public TaskTag() {
    }

    public TaskTag(Task task, Tag tag) {
        this.task = task;
        this.tag = tag;
        this.addedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public Tag getTag() { return tag; }
    public Instant getAddedAt() { return addedAt; }
}
