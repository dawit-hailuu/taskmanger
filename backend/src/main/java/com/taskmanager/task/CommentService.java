package com.taskmanager.task;

import com.taskmanager.exception.ResourceNotFoundException;
import com.taskmanager.project.ProjectMember;
import com.taskmanager.project.ProjectMemberRepository;
import com.taskmanager.task.dto.CommentResponse;
import com.taskmanager.task.model.Comment;
import com.taskmanager.task.repository.CommentRepository;
import com.taskmanager.user.User;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Comments on a task, with {@code @[Full Name]} mention parsing against eligible collaborators. */
@Service
public class CommentService {

    private static final Pattern MENTION_PATTERN = Pattern.compile("@\\[([^\\]]+)]");

    private final TaskService taskService;
    private final TaskHistoryService taskHistoryService;
    private final CommentRepository commentRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public CommentService(TaskService taskService, TaskHistoryService taskHistoryService,
                          CommentRepository commentRepository, ProjectMemberRepository projectMemberRepository) {
        this.taskService = taskService;
        this.taskHistoryService = taskHistoryService;
        this.commentRepository = commentRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> list(User user, Long taskId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        return commentRepository.findByTaskOrderByCreatedAtAsc(task).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public CommentResponse create(User user, Long taskId, String content) {
        Task task = taskService.getAccessibleTask(user, taskId);

        Comment comment = new Comment();
        comment.setTask(task);
        comment.setAuthor(user);
        comment.setContent(content);
        comment.setMentions(parseMentions(task, content));
        comment.setCreatedAt(Instant.now());
        Comment saved = commentRepository.save(comment);

        taskHistoryService.log(task, user, user.getName() + " commented on this task");
        return CommentResponse.from(saved);
    }

    @Transactional
    public CommentResponse update(User user, Long taskId, Long commentId, String content) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Comment comment = commentOrThrow(task, commentId);

        if (!comment.getAuthor().getId().equals(user.getId())) {
            throw new AccessDeniedException("You can only edit your own comments.");
        }

        comment.setContent(content);
        comment.setMentions(parseMentions(task, content));
        comment.setUpdatedAt(Instant.now());
        return CommentResponse.from(comment);
    }

    @Transactional
    public void delete(User user, Long taskId, Long commentId) {
        Task task = taskService.getAccessibleTask(user, taskId);
        Comment comment = commentOrThrow(task, commentId);

        boolean isAuthor = comment.getAuthor().getId().equals(user.getId());
        boolean isTaskOwner = task.getUser().getId().equals(user.getId());
        if (!isAuthor && !isTaskOwner) {
            throw new AccessDeniedException("You do not have permission to delete this comment.");
        }
        commentRepository.delete(comment);
    }

    private Set<User> parseMentions(Task task, String content) {
        List<User> eligible = eligibleMentionTargets(task);
        Set<User> mentioned = new HashSet<>();

        Matcher matcher = MENTION_PATTERN.matcher(content);
        while (matcher.find()) {
            String name = matcher.group(1).trim();
            eligible.stream()
                    .filter(u -> u.getName().equalsIgnoreCase(name))
                    .findFirst()
                    .ifPresent(mentioned::add);
        }
        return mentioned;
    }

    private List<User> eligibleMentionTargets(Task task) {
        if (task.getProject() == null) {
            return List.of(task.getUser());
        }
        List<User> members = projectMemberRepository.findByProject(task.getProject()).stream()
                .map(ProjectMember::getUser)
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
        if (members.stream().noneMatch(u -> u.getId().equals(task.getUser().getId()))) {
            members.add(task.getUser());
        }
        return members;
    }

    private Comment commentOrThrow(Task task, Long commentId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with id " + commentId));
        if (!comment.getTask().getId().equals(task.getId())) {
            throw new ResourceNotFoundException("Comment not found with id " + commentId);
        }
        return comment;
    }
}
