package com.taskmanager.task;

import com.taskmanager.project.Project;
import com.taskmanager.user.User;
import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
        name = "tasks",
        indexes = {
                @Index(name = "idx_tasks_user", columnList = "user_id"),
                @Index(name = "idx_tasks_status", columnList = "status"),
                @Index(name = "idx_tasks_priority", columnList = "priority"),
                @Index(name = "idx_tasks_due_date", columnList = "due_date"),
                @Index(name = "idx_tasks_project", columnList = "project_id"),
                @Index(name = "idx_tasks_parent", columnList = "parent_id"),
                @Index(name = "idx_tasks_user_parent", columnList = "user_id, parent_id"),
                @Index(name = "idx_tasks_parent_position", columnList = "parent_id, position")
        }
)
@EntityListeners(AuditingEntityListener.class)
public class Task {

    /** Weight a task gets when the caller doesn't specify one. */
    public static final int DEFAULT_WEIGHT = 100;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Priority priority = Priority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status = TaskStatus.TODO;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    @Column(name = "actual_minutes", nullable = false)
    private int actualMinutes = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecurrenceType recurrence = RecurrenceType.NONE;

    @Column(name = "recurrence_end_date")
    private LocalDate recurrenceEndDate;

    /** Owner of the task. Tasks are scoped per-user. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_tasks_user"))
    private User user;

    /** Optional project this task belongs to. Null for personal, unfiled tasks. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", foreignKey = @ForeignKey(name = "fk_tasks_project"))
    private Project project;

    // ----- task tree (unlimited nesting) -----

    /**
     * Parent task, or {@code null} for a root task. Self-referencing, so the
     * hierarchy nests without limit: Task → Subtask → Subtask → …
     *
     * <p>Children are not mapped as a collection on purpose. Traversal happens
     * through explicit repository queries (a single recursive CTE for a whole
     * subtree) so no code path can accidentally trigger a depth-proportional
     * cascade of lazy loads. The FK carries {@code ON DELETE CASCADE}, so
     * deleting a task removes its descendants in one database round-trip.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", foreignKey = @ForeignKey(name = "fk_tasks_parent"))
    private Task parent;

    /**
     * This task's share of its parent's total effort. Siblings may not sum to
     * more than the parent's own weight — enforced in the service layer.
     */
    @Column(nullable = false)
    private int weight = DEFAULT_WEIGHT;

    /**
     * Weighted completion, 0..100. Denormalised so paged list queries never walk
     * the tree; recomputed bottom-up by {@code TaskProgressService} whenever a
     * descendant changes. Never set this directly — it is always derived.
     */
    @Column(nullable = false)
    private int progress = 0;

    /**
     * Cached distance from the root (0 for a root task). Derived from the
     * hierarchy and used for indentation and for ordering the bottom-up progress
     * rollup. It is not a limit — nothing caps how deep this can go.
     */
    @Column(nullable = false)
    private int depth = 0;

    /** Ordering among siblings, so drag & drop reordering can be persisted. */
    @Column(nullable = false)
    private int position = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Task() {
    }

    public Task(Long id, String title, String description, Priority priority, TaskStatus status,
                LocalDate dueDate, User user, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.priority = (priority != null) ? priority : Priority.MEDIUM;
        this.status = (status != null) ? status : TaskStatus.TODO;
        this.dueDate = dueDate;
        this.user = user;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private String title;
        private String description;
        private Priority priority = Priority.MEDIUM;
        private TaskStatus status = TaskStatus.TODO;
        private LocalDate dueDate;
        private User user;
        private Instant createdAt;
        private Instant updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder priority(Priority priority) { this.priority = priority; return this; }
        public Builder status(TaskStatus status) { this.status = status; return this; }
        public Builder dueDate(LocalDate dueDate) { this.dueDate = dueDate; return this; }
        public Builder user(User user) { this.user = user; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(Instant updatedAt) { this.updatedAt = updatedAt; return this; }

        public Task build() {
            return new Task(id, title, description, priority, status, dueDate, user, createdAt, updatedAt);
        }
    }

    // ----- getters / setters -----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }

    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public Integer getEstimatedMinutes() { return estimatedMinutes; }
    public void setEstimatedMinutes(Integer estimatedMinutes) { this.estimatedMinutes = estimatedMinutes; }

    public int getActualMinutes() { return actualMinutes; }
    public void setActualMinutes(int actualMinutes) { this.actualMinutes = actualMinutes; }

    public RecurrenceType getRecurrence() { return recurrence; }
    public void setRecurrence(RecurrenceType recurrence) { this.recurrence = recurrence; }

    public LocalDate getRecurrenceEndDate() { return recurrenceEndDate; }
    public void setRecurrenceEndDate(LocalDate recurrenceEndDate) { this.recurrenceEndDate = recurrenceEndDate; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    public Task getParent() { return parent; }
    public void setParent(Task parent) { this.parent = parent; }

    /** Convenience accessor that avoids initialising the lazy parent proxy's state. */
    public Long getParentId() {
        return parent != null ? parent.getId() : null;
    }

    public boolean isRoot() {
        return parent == null;
    }

    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }

    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }

    public int getDepth() { return depth; }
    public void setDepth(int depth) { this.depth = depth; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
