package com.taskmanager.task;

import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.task.dto.CreateChildTaskRequest;
import com.taskmanager.task.dto.SubtaskResponse;
import com.taskmanager.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Backwards-compatible adapter for the original single-level subtask checklist.
 *
 * <p>Subtasks are no longer a separate entity: they are ordinary child tasks in
 * the recursive tree, which is what makes unlimited nesting possible. This class
 * keeps the old {@code /api/tasks/{id}/subtasks} contract working by projecting a
 * task's <em>direct children</em> onto the flat {@link SubtaskResponse} shape.
 *
 * <p>Deliberately thin: every rule (access, weights, progress rollup) lives in
 * {@link TaskTreeService} / {@link TaskService}, so nothing here duplicates it.
 * New clients should prefer the tree endpoints, which expose weight and progress.
 */
@Service
public class SubtaskService {

    private final TaskService taskService;
    private final TaskTreeService taskTreeService;
    private final TaskRepository taskRepository;
    private final TaskHistoryService taskHistoryService;
    private final TaskProgressService progressService;

    public SubtaskService(TaskService taskService,
                          TaskTreeService taskTreeService,
                          TaskRepository taskRepository,
                          TaskHistoryService taskHistoryService,
                          TaskProgressService progressService) {
        this.taskService = taskService;
        this.taskTreeService = taskTreeService;
        this.taskRepository = taskRepository;
        this.taskHistoryService = taskHistoryService;
        this.progressService = progressService;
    }

    @Transactional(readOnly = true)
    public List<SubtaskResponse> list(User user, Long taskId) {
        return taskTreeService.children(user, taskId).stream()
                .map(SubtaskResponse::from)
                .toList();
    }

    @Transactional
    public SubtaskResponse create(User user, Long taskId, String title) {
        Task child = taskTreeService.addChild(user, taskId,
                new CreateChildTaskRequest(title, null, null, null, null));
        return SubtaskResponse.from(child);
    }

    @Transactional
    public SubtaskResponse update(User user, Long taskId, Long subtaskId, String title, boolean completed) {
        Task parent = taskService.getAccessibleTask(user, taskId);
        Task subtask = childOrThrow(parent, subtaskId);

        boolean completionChanged = (subtask.getStatus() == TaskStatus.COMPLETED) != completed;

        subtask.setTitle(title);
        if (completionChanged) {
            subtask.setStatus(completed ? TaskStatus.COMPLETED : TaskStatus.TODO);
        }
        Task saved = taskRepository.save(subtask);

        if (completionChanged) {
            taskHistoryService.log(parent, user,
                    (completed ? "Completed" : "Reopened") + " subtask: " + title);
            // Ripples the weighted average up through every ancestor.
            progressService.recomputeFrom(saved);
        }
        return SubtaskResponse.from(saved);
    }

    @Transactional
    public void delete(User user, Long taskId, Long subtaskId) {
        Task parent = taskService.getAccessibleTask(user, taskId);
        Task subtask = childOrThrow(parent, subtaskId);
        String title = subtask.getTitle();

        // Reuses the standard delete so subtree cascade, permissions and the
        // parent's progress rollup all behave identically to any other task.
        taskService.delete(user, subtask.getId());
        taskHistoryService.log(parent, user, "Subtask removed: " + title);
    }

    /** Masks existence (404) when the id isn't actually a child of this task. */
    private Task childOrThrow(Task parent, Long subtaskId) {
        Task candidate = taskRepository.findById(subtaskId)
                .orElseThrow(() -> new ResourceNotFoundException("Subtask not found with id " + subtaskId));

        if (!parent.getId().equals(candidate.getParentId())) {
            throw new ResourceNotFoundException("Subtask not found with id " + subtaskId);
        }
        return candidate;
    }
}
