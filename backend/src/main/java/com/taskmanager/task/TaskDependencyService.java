package com.taskmanager.task;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ConflictException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.task.dto.TaskDependencyResponse;
import com.taskmanager.task.model.TaskDependency;
import com.taskmanager.task.repository.TaskDependencyRepository;
import com.taskmanager.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Manages "blocked by" links between tasks. Only direct cycles (A blocks B
 * while B already blocks A) are rejected; deeper cycles (A→B→C→A) are not
 * detected — a known simplification for this phase.
 */
@Service
public class TaskDependencyService {

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;
    private final TaskDependencyRepository dependencyRepository;

    public TaskDependencyService(TaskService taskService, TaskHistoryService taskHistoryService,
                                 TaskDependencyRepository dependencyRepository) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
        this.dependencyRepository = dependencyRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, List<TaskDependencyResponse>> list(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);

        List<TaskDependencyResponse> blockedBy = dependencyRepository.findByTaskOrderByCreatedAtAsc(task).stream()
                .map(d -> TaskDependencyResponse.from(d.getDependsOn()))
                .toList();
        List<TaskDependencyResponse> blocks = dependencyRepository.findByDependsOnOrderByCreatedAtAsc(task).stream()
                .map(d -> TaskDependencyResponse.from(d.getTask()))
                .toList();

        return Map.of("blockedBy", blockedBy, "blocks", blocks);
    }

    @Transactional
    public TaskDependencyResponse add(User user, Long taskId, Long dependsOnTaskId) {
        if (taskId.equals(dependsOnTaskId)) {
            throw new BadRequestException("A task cannot depend on itself.");
        }

        Task task = taskService.getAccessibleTask(user, taskId);
        Task dependsOn = taskService.getAccessibleTask(user, dependsOnTaskId);

        if (dependencyRepository.existsByTaskAndDependsOn(task, dependsOn)) {
            throw new ConflictException("This dependency already exists.");
        }
        if (dependencyRepository.existsByTaskAndDependsOn(dependsOn, task)) {
            throw new BadRequestException("That would create a circular dependency.");
        }

        dependencyRepository.save(new TaskDependency(task, dependsOn, user));
        taskHistoryService.log(task, user, "Marked as blocked by \"" + dependsOn.getTitle() + "\"");
        return TaskDependencyResponse.from(dependsOn);
    }

    @Transactional
    public void remove(User user, Long taskId, Long dependsOnTaskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Task dependsOn = taskService.getAccessibleTask(user, dependsOnTaskId);

        TaskDependency dependency = dependencyRepository.findByTaskAndDependsOn(task, dependsOn)
                .orElseThrow(() -> new ResourceNotFoundException("That dependency does not exist."));

        dependencyRepository.delete(dependency);
        taskHistoryService.log(task, user, "No longer blocked by \"" + dependsOn.getTitle() + "\"");
    }
}
