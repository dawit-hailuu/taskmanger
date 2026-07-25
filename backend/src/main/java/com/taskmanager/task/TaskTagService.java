package com.taskmanager.task;

import com.taskmanager.exception.BadRequestException;
import com.taskmanager.exception.ConflictException;
import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.tag.Tag;
import com.taskmanager.tag.TagService;
import com.taskmanager.tag.dto.TagResponse;
import com.taskmanager.task.model.TaskTag;
import com.taskmanager.task.repository.TaskTagRepository;
import com.taskmanager.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Attaches/detaches workspace tags to individual tasks. */
@Service
public class TaskTagService {

    private final TaskService taskService;
    private final TagService tagService;
    private final TaskTagRepository taskTagRepository;

    public TaskTagService(TaskService taskService, TagService tagService, TaskTagRepository taskTagRepository) {
        this.taskService = taskService;
        this.tagService = tagService;
        this.taskTagRepository = taskTagRepository;
    }

    @Transactional(readOnly = true)
    public List<TagResponse> listForTask(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        return taskTagRepository.findByTaskOrderByAddedAtAsc(task).stream()
                .map(TaskTag::getTag)
                .map(TagResponse::from)
                .toList();
    }

    @Transactional
    public TagResponse attach(User user, Long taskId, Long tagId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        if (task.getProject() == null) {
            throw new BadRequestException("Add this task to a project before tagging it.");
        }

        Tag tag = tagService.getInWorkspace(tagId, task.getProject().getWorkspace());
        if (taskTagRepository.existsByTaskAndTag(task, tag)) {
            throw new ConflictException("This task is already tagged \"" + tag.getName() + "\".");
        }

        taskTagRepository.save(new TaskTag(task, tag));
        return TagResponse.from(tag);
    }

    @Transactional
    public void detach(User user, Long taskId, Long tagId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        if (task.getProject() == null) {
            throw new ResourceNotFoundException("This task has no tags.");
        }

        Tag tag = tagService.getInWorkspace(tagId, task.getProject().getWorkspace());
        TaskTag link = taskTagRepository.findByTaskAndTag(task, tag)
                .orElseThrow(() -> new ResourceNotFoundException("This task is not tagged \"" + tag.getName() + "\"."));
        taskTagRepository.delete(link);
    }
}
