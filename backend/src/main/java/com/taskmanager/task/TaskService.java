package com.taskmanager.task;

import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.task.dto.TaskRequest;
import com.taskmanager.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Set;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    /** Whitelist of sortable fields to prevent arbitrary property injection. */
    private static final Set<String> SORTABLE_FIELDS =
            Set.of("createdAt", "updatedAt", "dueDate", "priority", "status", "title");

    @Transactional(readOnly = true)
    public Page<Task> search(User owner,
                             String keyword,
                             TaskStatus status,
                             Priority priority,
                             int page,
                             int size,
                             String sortBy,
                             String direction) {

        Specification<Task> spec = TaskSpecifications.ownedBy(owner.getId());

        if (StringUtils.hasText(keyword)) {
            spec = spec.and(TaskSpecifications.matchesKeyword(keyword.trim()));
        }
        if (status != null) {
            spec = spec.and(TaskSpecifications.hasStatus(status));
        }
        if (priority != null) {
            spec = spec.and(TaskSpecifications.hasPriority(priority));
        }

        Pageable pageable = buildPageable(page, size, sortBy, direction);
        return taskRepository.findAll(spec, pageable);
    }

    @Transactional(readOnly = true)
    public Task getOwnedTask(User owner, Long id) {
        return taskRepository.findByIdAndUserId(id, owner.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id " + id));
    }

    @Transactional
    public Task create(User owner, TaskRequest request) {
        Task task = Task.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority())
                .status(request.status())
                .dueDate(request.dueDate())
                .user(owner)
                .build();
        return taskRepository.save(task);
    }

    @Transactional
    public Task update(User owner, Long id, TaskRequest request) {
        Task task = getOwnedTask(owner, id);
        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setPriority(request.priority());
        task.setStatus(request.status());
        task.setDueDate(request.dueDate());
        return taskRepository.save(task);
    }

    @Transactional
    public void delete(User owner, Long id) {
        Task task = getOwnedTask(owner, id);
        taskRepository.delete(task);
    }

    private Pageable buildPageable(int page, int size, String sortBy, String direction) {
        String safeSortBy = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "createdAt";
        Sort.Direction dir = "asc".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        return PageRequest.of(safePage, safeSize, Sort.by(new Sort.Order(dir, safeSortBy)));
    }

    /** Exposed for tests / callers that need the sortable field list. */
    public static List<String> sortableFields() {
        return SORTABLE_FIELDS.stream().sorted().toList();
    }
}
