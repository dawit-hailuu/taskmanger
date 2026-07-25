package com.taskmanager.task;

import com.taskmanager.task.model.TaskHistory;
import com.taskmanager.task.repository.TaskHistoryRepository;
import com.taskmanager.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Records and retrieves a task's audit trail. */
@Service
public class TaskHistoryService {

    private final TaskHistoryRepository repository;

    public TaskHistoryService(TaskHistoryRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(Task task, User actor, String summary) {
        repository.save(new TaskHistory(task, actor, summary));
    }

    @Transactional(readOnly = true)
    public Page<TaskHistory> history(Task task, Pageable pageable) {
        return repository.findByTaskOrderByCreatedAtDesc(task, pageable);
    }
}
