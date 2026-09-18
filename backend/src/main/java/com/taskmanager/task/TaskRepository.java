package com.taskmanager.task;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskRepository
        extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    /** Ownership-aware lookup so users can only touch their own tasks. */
    Optional<Task> findByIdAndUserId(Long id, Long userId);

    Page<Task> findByProjectId(Long projectId, Pageable pageable);

    long countByProjectId(Long projectId);

    long countByProjectIdAndStatus(Long projectId, TaskStatus status);

    // ----- task tree -----

    /**
     * Direct children, in the order the user arranged them.
     *
     * <p>Uses {@code Parent_Id} (explicit underscore) rather than the shorter
     * {@code ParentId}: {@link Task} exposes a plain (non-persistent) getter
     * {@code getParentId()} alongside the real {@code parent} association, and
     * Spring Data's derived-query property resolution picks that getter up as
     * if it were a mapped attribute — parses fine, then blows up at query-build
     * time with "Could not resolve attribute 'parentId'". The underscore forces
     * traversal through the actual {@code parent} association instead.
     */
    List<Task> findByParent_IdOrderByPositionAscIdAsc(Long parentId);

    long countByParent_Id(Long parentId);

    /** Sum of every direct child's weight. */
    @Query("SELECT COALESCE(SUM(t.weight), 0) FROM Task t WHERE t.parent.id = :parentId")
    int sumChildWeights(@Param("parentId") Long parentId);

    /**
     * Sum of the direct children's weights, ignoring one child — used when
     * re-weighting an existing child so its current weight doesn't count
     * against the budget it is being fitted into.
     */
    @Query("SELECT COALESCE(SUM(t.weight), 0) FROM Task t WHERE t.parent.id = :parentId AND t.id <> :excludedChildId")
    int sumChildWeightsExcluding(@Param("parentId") Long parentId,
                                @Param("excludedChildId") Long excludedChildId);

    /**
     * Whole subtree rooted at {@code rootId} (inclusive) in ONE query, at any
     * depth, via a recursive CTE. The alternative — following the parent/child
     * association level by level — costs a query per level.
     */
    @Query(value = """
            WITH RECURSIVE subtree AS (
                SELECT * FROM tasks WHERE id = :rootId
                UNION ALL
                SELECT t.* FROM tasks t JOIN subtree s ON t.parent_id = s.id
            )
            SELECT * FROM subtree
            """, nativeQuery = true)
    List<Task> findSubtree(@Param("rootId") Long rootId);

    /**
     * Same as {@link #findSubtree(Long)} but for many roots at once — lets the
     * paged tree endpoint load one page of roots plus every descendant in a
     * single round-trip instead of one query per root.
     */
    @Query(value = """
            WITH RECURSIVE subtree AS (
                SELECT * FROM tasks WHERE id IN (:rootIds)
                UNION ALL
                SELECT t.* FROM tasks t JOIN subtree s ON t.parent_id = s.id
            )
            SELECT * FROM subtree
            """, nativeQuery = true)
    List<Task> findSubtrees(@Param("rootIds") Collection<Long> rootIds);

    /**
     * Ids of every descendant of {@code taskId}, excluding the task itself.
     * Used to reject a move that would make a task its own ancestor.
     */
    @Query(value = """
            WITH RECURSIVE descendants AS (
                SELECT id FROM tasks WHERE parent_id = :taskId
                UNION ALL
                SELECT t.id FROM tasks t JOIN descendants d ON t.parent_id = d.id
            )
            SELECT id FROM descendants
            """, nativeQuery = true)
    List<Long> findDescendantIds(@Param("taskId") Long taskId);

    /**
     * Re-stamps {@code depth} across a moved subtree in one statement, so a move
     * costs the same whether the subtree is 2 levels deep or 200.
     */
    // flushAutomatically so any pending parent change is visible to the CTE;
    // clearAutomatically is deliberately left off, since the caller keeps using
    // the entities it already holds.
    @Modifying(flushAutomatically = true)
    @Query(value = """
            WITH RECURSIVE subtree AS (
                SELECT id, CAST(:newDepth AS INTEGER) AS d FROM tasks WHERE id = :rootId
                UNION ALL
                SELECT t.id, s.d + 1 FROM tasks t JOIN subtree s ON t.parent_id = s.id
            )
            UPDATE tasks t SET depth = s.d FROM subtree s WHERE t.id = s.id AND t.depth <> s.d
            """, nativeQuery = true)
    void restampSubtreeDepth(@Param("rootId") Long rootId, @Param("newDepth") int newDepth);

    /** Highest position among a parent's children, for appending a new child. */
    @Query("SELECT COALESCE(MAX(t.position), -1) FROM Task t WHERE t.parent.id = :parentId")
    int maxChildPosition(@Param("parentId") Long parentId);

    /** Highest position among a user's root tasks, for appending a new root. */
    @Query("SELECT COALESCE(MAX(t.position), -1) FROM Task t WHERE t.parent IS NULL AND t.user.id = :userId")
    int maxRootPosition(@Param("userId") Long userId);

    /**
     * Direct-child counts for a batch of tasks, so a page of N tasks costs one
     * extra query instead of N. Returns {@code [parentId, count]} rows.
     */
    @Query("SELECT t.parent.id, COUNT(t) FROM Task t WHERE t.parent.id IN :parentIds GROUP BY t.parent.id")
    List<Object[]> countChildrenByParentIds(@Param("parentIds") Collection<Long> parentIds);

    // ----- dashboard aggregates -----

    /**
     * Per-status counts for one user in a single grouped query.
     * Returns {@code [status, count]} rows.
     */
    @Query("SELECT t.status, COUNT(t) FROM Task t WHERE t.user.id = :userId GROUP BY t.status")
    List<Object[]> countByStatusForUser(@Param("userId") Long userId);

    /** Per-priority counts of still-open tasks. Same {@code [key, count]} shape. */
    @Query("""
            SELECT t.priority, COUNT(t) FROM Task t
            WHERE t.user.id = :userId AND t.status NOT IN :excludedStatuses
            GROUP BY t.priority
            """)
    List<Object[]> countOpenByPriorityForUser(@Param("userId") Long userId,
                                             @Param("excludedStatuses") Collection<TaskStatus> excludedStatuses);

    /** Unfinished tasks whose due date has already passed. */
    @Query("""
            SELECT COUNT(t) FROM Task t
            WHERE t.user.id = :userId AND t.dueDate < :today AND t.status NOT IN :excludedStatuses
            """)
    long countOverdue(@Param("userId") Long userId,
                      @Param("today") LocalDate today,
                      @Param("excludedStatuses") Collection<TaskStatus> excludedStatuses);

    /** Unfinished, overdue tasks, soonest-missed first. */
    @Query("""
            SELECT t FROM Task t
            WHERE t.user.id = :userId AND t.dueDate < :today AND t.status NOT IN :excludedStatuses
            ORDER BY t.dueDate ASC
            """)
    List<Task> findOverdue(@Param("userId") Long userId,
                           @Param("today") LocalDate today,
                           @Param("excludedStatuses") Collection<TaskStatus> excludedStatuses,
                           Pageable pageable);

    /**
     * Unfinished tasks due within an inclusive date window — backs both
     * "due today" ({@code from == to}) and "upcoming this week".
     */
    @Query("""
            SELECT t FROM Task t
            WHERE t.user.id = :userId AND t.dueDate BETWEEN :from AND :to
              AND t.status NOT IN :excludedStatuses
            ORDER BY t.dueDate ASC
            """)
    List<Task> findDueBetween(@Param("userId") Long userId,
                              @Param("from") LocalDate from,
                              @Param("to") LocalDate to,
                              @Param("excludedStatuses") Collection<TaskStatus> excludedStatuses,
                              Pageable pageable);

    @Query("""
            SELECT COUNT(t) FROM Task t
            WHERE t.user.id = :userId AND t.dueDate BETWEEN :from AND :to
              AND t.status NOT IN :excludedStatuses
            """)
    long countDueBetween(@Param("userId") Long userId,
                         @Param("from") LocalDate from,
                         @Param("to") LocalDate to,
                         @Param("excludedStatuses") Collection<TaskStatus> excludedStatuses);

    /** Average weighted progress across a user's root tasks. */
    @Query("SELECT COALESCE(AVG(t.progress), 0) FROM Task t WHERE t.user.id = :userId AND t.parent IS NULL")
    double averageRootProgress(@Param("userId") Long userId);

    /** A user's most recently touched tasks, for the dashboard's "recent" strip. */
    @Query("SELECT t FROM Task t WHERE t.user.id = :userId ORDER BY t.updatedAt DESC")
    List<Task> findRecentlyUpdated(@Param("userId") Long userId, Pageable pageable);

    /**
     * Daily completion counts over a window, for the dashboard's activity chart.
     * Grouped in the database so the API never ships raw rows for this.
     * Returns {@code [day, count]} rows.
     */
    @Query(value = """
            SELECT CAST(t.updated_at AS DATE) AS day, COUNT(*) AS completed
            FROM tasks t
            WHERE t.user_id = :userId
              AND t.status = 'COMPLETED'
              AND t.updated_at >= :since
            GROUP BY CAST(t.updated_at AS DATE)
            ORDER BY day
            """, nativeQuery = true)
    List<Object[]> countCompletionsPerDay(@Param("userId") Long userId,
                                          @Param("since") java.time.Instant since);
}
