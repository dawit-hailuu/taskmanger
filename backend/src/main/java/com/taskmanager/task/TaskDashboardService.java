package com.taskmanager.task;

import com.taskmanager.task.dto.DashboardResponse;
import com.taskmanager.task.dto.TaskResponse;
import com.taskmanager.task.dto.TaskStatsResponse;
import com.taskmanager.task.repository.TaskHistoryRepository;
import com.taskmanager.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the dashboard's aggregate view.
 *
 * <p>Every number comes from a grouped query — nothing is counted by streaming
 * rows into memory — and the whole payload is assembled in one service call, so
 * the dashboard costs a fixed handful of queries regardless of how many tasks the
 * user has.
 */
@Service
public class TaskDashboardService {

    /** How many rows each dashboard list shows. */
    private static final int LIST_LIMIT = 5;
    /** Days of history behind the completion sparkline. */
    private static final int TREND_DAYS = 14;
    /** Rows in the activity feed. */
    private static final int ACTIVITY_LIMIT = 8;
    /** "Upcoming" horizon, in days after today. */
    private static final int UPCOMING_DAYS = 7;

    private final TaskRepository taskRepository;
    private final TaskHistoryRepository taskHistoryRepository;
    private final TaskService taskService;

    public TaskDashboardService(TaskRepository taskRepository,
                                TaskHistoryRepository taskHistoryRepository,
                                TaskService taskService) {
        this.taskRepository = taskRepository;
        this.taskHistoryRepository = taskHistoryRepository;
        this.taskService = taskService;
    }

    @Transactional(readOnly = true)
    public TaskStatsResponse stats(User user) {
        Long userId = user.getId();
        LocalDate today = LocalDate.now();

        Map<TaskStatus, Long> byStatus = countsByStatus(userId);
        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        long completed = byStatus.getOrDefault(TaskStatus.COMPLETED, 0L);
        long cancelled = byStatus.getOrDefault(TaskStatus.CANCELLED, 0L);
        long open = total - completed - cancelled;

        return new TaskStatsResponse(
                total,
                countRoots(userId),
                toNameKeyedMap(byStatus, TaskStatus.values()),
                openCountsByPriority(userId),
                open,
                completed,
                taskRepository.countOverdue(userId, today, TaskStatus.TERMINAL),
                taskRepository.countDueBetween(userId, today, today, TaskStatus.TERMINAL),
                taskRepository.countDueBetween(userId, today, today.plusDays(UPCOMING_DAYS), TaskStatus.TERMINAL),
                percentage(completed, total),
                (int) Math.round(taskRepository.averageRootProgress(userId))
        );
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(User user) {
        Long userId = user.getId();
        LocalDate today = LocalDate.now();
        Pageable limit = PageRequest.of(0, LIST_LIMIT);

        List<Task> dueToday = taskRepository.findDueBetween(
                userId, today, today, TaskStatus.TERMINAL, limit);
        List<Task> upcoming = taskRepository.findDueBetween(
                userId, today.plusDays(1), today.plusDays(UPCOMING_DAYS), TaskStatus.TERMINAL, limit);
        List<Task> overdue = taskRepository.findOverdue(userId, today, TaskStatus.TERMINAL, limit);
        List<Task> recent = taskRepository.findRecentlyUpdated(userId, limit);

        return new DashboardResponse(
                stats(user),
                toResponses(dueToday),
                toResponses(upcoming),
                toResponses(overdue),
                toResponses(recent),
                completionTrend(userId, today),
                activity(userId)
        );
    }

    // ---- pieces ----

    private Map<TaskStatus, Long> countsByStatus(Long userId) {
        Map<TaskStatus, Long> counts = new EnumMap<>(TaskStatus.class);
        for (Object[] row : taskRepository.countByStatusForUser(userId)) {
            counts.put((TaskStatus) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private Map<String, Long> openCountsByPriority(Long userId) {
        Map<Priority, Long> counts = new EnumMap<>(Priority.class);
        for (Object[] row : taskRepository.countOpenByPriorityForUser(userId, TaskStatus.TERMINAL)) {
            counts.put((Priority) row[0], ((Number) row[1]).longValue());
        }
        return toNameKeyedMap(counts, Priority.values());
    }

    private long countRoots(Long userId) {
        return taskRepository.count(
                TaskSpecifications.ownedBy(userId).and(TaskSpecifications.isRoot()));
    }

    /**
     * Daily completion counts for the last {@link #TREND_DAYS} days, with zero-filled
     * gaps so the chart has one point per day and needs no client-side padding.
     */
    private List<DashboardResponse.CompletionPoint> completionTrend(Long userId, LocalDate today) {
        LocalDate from = today.minusDays(TREND_DAYS - 1L);
        Instant since = Instant.now().minus(Duration.ofDays(TREND_DAYS));

        Map<LocalDate, Long> counted = new LinkedHashMap<>();
        for (Object[] row : taskRepository.countCompletionsPerDay(userId, since)) {
            counted.put(toLocalDate(row[0]), ((Number) row[1]).longValue());
        }

        List<DashboardResponse.CompletionPoint> trend = new ArrayList<>(TREND_DAYS);
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            trend.add(new DashboardResponse.CompletionPoint(day, counted.getOrDefault(day, 0L)));
        }
        return trend;
    }

    private List<DashboardResponse.ActivityEntry> activity(Long userId) {
        return taskHistoryRepository.findRecentForUser(userId, PageRequest.of(0, ACTIVITY_LIMIT))
                .stream()
                .map(DashboardResponse.ActivityEntry::from)
                .toList();
    }

    private List<TaskResponse> toResponses(List<Task> tasks) {
        tasks.forEach(taskService::touchLazyAssociations);
        Map<Long, Integer> counts = taskService.childCounts(tasks.stream().map(Task::getId).toList());
        return tasks.stream().map(task -> TaskResponse.withCounts(task, counts)).toList();
    }

    // ---- small helpers ----

    /**
     * Re-keys an enum-keyed count map by name and fills in the zeros, so clients
     * can index it directly without guarding for missing buckets.
     */
    private <E extends Enum<E>> Map<String, Long> toNameKeyedMap(Map<E, Long> counts, E[] all) {
        Map<String, Long> named = new LinkedHashMap<>();
        for (E value : all) {
            named.put(value.name(), counts.getOrDefault(value, 0L));
        }
        return named;
    }

    private int percentage(long part, long whole) {
        return whole == 0 ? 0 : (int) Math.round((part * 100.0) / whole);
    }

    /** The JDBC driver may hand back {@code java.sql.Date} or already a LocalDate. */
    private LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        return LocalDate.parse(value.toString());
    }
}
