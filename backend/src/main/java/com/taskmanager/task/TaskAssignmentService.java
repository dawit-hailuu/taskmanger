package com.taskmanager.task;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ConflictException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.project.ProjectService;
import com.taskmanager.task.dto.TaskCollaboratorResponse;
import com.taskmanager.task.model.TaskAssignee;
import com.taskmanager.task.model.TaskWatcher;
import com.taskmanager.task.repository.TaskAssigneeRepository;
import com.taskmanager.task.repository.TaskWatcherRepository;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Manages who a task is assigned to and who is watching it. */
@Service
public class TaskAssignmentService {

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;
    private final ProjectService projectService;
    private final UserRepository userRepository;
    private final TaskAssigneeRepository assigneeRepository;
    private final TaskWatcherRepository watcherRepository;

    public TaskAssignmentService(TaskService taskService,
                                 TaskHistoryService taskHistoryService,
                                 ProjectService projectService,
                                 UserRepository userRepository,
                                 TaskAssigneeRepository assigneeRepository,
                                 TaskWatcherRepository watcherRepository) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
        this.projectService = projectService;
        this.userRepository = userRepository;
        this.assigneeRepository = assigneeRepository;
        this.watcherRepository = watcherRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskCollaboratorResponse> listAssignees(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        return assigneeRepository.findByTaskOrderByAssignedAtAsc(task).stream()
                .map(TaskCollaboratorResponse::from)
                .toList();
    }

    @Transactional
    public TaskCollaboratorResponse addAssignee(User actingUser, Long taskId, Long targetUserId) {
        Task task = taskService.getAccessibleTask(actingUser, taskId);
        User target = userOrThrow(targetUserId);
        requireAssignable(task, target);

        if (assigneeRepository.existsByTaskAndUser(task, target)) {
            throw new ConflictException(target.getName() + " is already assigned to this task.");
        }

        TaskAssignee saved = assigneeRepository.save(new TaskAssignee(task, target, actingUser));
        taskHistoryService.log(task, actingUser, target.getName() + " was assigned to this task");
        return TaskCollaboratorResponse.from(saved);
    }

    @Transactional
    public void removeAssignee(User actingUser, Long taskId, Long targetUserId) {
        Task task = taskService.getAccessibleTask(actingUser, taskId);
        User target = userOrThrow(targetUserId);

        TaskAssignee assignee = assigneeRepository.findByTaskAndUser(task, target)
                .orElseThrow(() -> new ResourceNotFoundException(target.getName() + " is not assigned to this task."));

        assigneeRepository.delete(assignee);
        taskHistoryService.log(task, actingUser, target.getName() + " was unassigned from this task");
    }

    @Transactional(readOnly = true)
    public List<TaskCollaboratorResponse> listWatchers(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        return watcherRepository.findByTaskOrderByWatchedAtAsc(task).stream()
                .map(TaskCollaboratorResponse::from)
                .toList();
    }

    /** A user always watches/unwatches on their own behalf. */
    @Transactional
    public TaskCollaboratorResponse watch(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        if (watcherRepository.existsByTaskAndUser(task, user)) {
            throw new ConflictException("You are already watching this task.");
        }
        TaskWatcher saved = watcherRepository.save(new TaskWatcher(task, user));
        return TaskCollaboratorResponse.from(saved);
    }

    @Transactional
    public void unwatch(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        TaskWatcher watcher = watcherRepository.findByTaskAndUser(task, user)
                .orElseThrow(() -> new ResourceNotFoundException("You are not watching this task."));
        watcherRepository.delete(watcher);
    }

    private void requireAssignable(Task task, User target) {
        if (task.getProject() == null) {
            throw new BadRequestException("Add this task to a project before assigning collaborators.");
        }
        if (!projectService.isMember(task.getProject(), target)) {
            throw new BadRequestException(target.getName() + " is not a member of this task's project.");
        }
    }

    private User userOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + userId));
    }
}
