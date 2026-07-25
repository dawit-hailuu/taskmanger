package com.taskmanager.task;

import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.task.dto.SubtaskResponse;
import com.taskmanager.task.model.Subtask;
import com.taskmanager.task.repository.SubtaskRepository;
import com.taskmanager.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class SubtaskService {

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;
    private final SubtaskRepository subtaskRepository;

    public SubtaskService(TaskService taskService, TaskHistoryService taskHistoryService,
                          SubtaskRepository subtaskRepository) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
        this.subtaskRepository = subtaskRepository;
    }

    @Transactional(readOnly = true)
    public List<SubtaskResponse> list(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        return subtaskRepository.findByTaskOrderByCreatedAtAsc(task).stream()
                .map(SubtaskResponse::from)
                .toList();
    }

    @Transactional
    public SubtaskResponse create(User user, Long taskId, String title) {
        Task task = taskService.getAccessibleTask(user, taskId);

        Subtask subtask = new Subtask();
        subtask.setTask(task);
        subtask.setTitle(title);
        subtask.setCreatedAt(Instant.now());
        Subtask saved = subtaskRepository.save(subtask);

        taskHistoryService.log(task, user, "Subtask added: " + title);
        return SubtaskResponse.from(saved);
    }

    @Transactional
    public SubtaskResponse update(User user, Long taskId, Long subtaskId, String title, boolean completed) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Subtask subtask = subtaskOrThrow(task, subtaskId);

        boolean completionChanged = subtask.isCompleted() != completed;
        subtask.setTitle(title);
        subtask.setCompleted(completed);

        if (completionChanged) {
            taskHistoryService.log(task, user,
                    (completed ? "Completed" : "Reopened") + " subtask: " + title);
        }
        return SubtaskResponse.from(subtask);
    }

    @Transactional
    public void delete(User user, Long taskId, Long subtaskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Subtask subtask = subtaskOrThrow(task, subtaskId);
        subtaskRepository.delete(subtask);
        taskHistoryService.log(task, user, "Subtask removed: " + subtask.getTitle());
    }

    private Subtask subtaskOrThrow(Task task, Long subtaskId) {
        Subtask subtask = subtaskRepository.findById(subtaskId)
                .orElseThrow(() -> new ResourceNotFoundException("Subtask not found with id " + subtaskId));
        if (!subtask.getTask().getId().equals(task.getId())) {
            throw new ResourceNotFoundException("Subtask not found with id " + subtaskId);
        }
        return subtask;
    }
}
