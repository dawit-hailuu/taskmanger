-- =====================================================================
-- V11 — Recursive task tree + task weights + weighted progress.
--
-- Replaces the single-level `subtasks` checklist with a self-referencing
-- task hierarchy of UNLIMITED depth:
--
--   Task → Subtask → Subtask → Subtask → …
--
-- New columns on `tasks`:
--   parent_id — self FK; NULL for a root task. ON DELETE CASCADE so
--               removing a task removes its whole subtree in one shot.
--   weight    — this task's share of its parent's total effort. Siblings
--               may not sum to more than the parent's weight (enforced in
--               the service layer, which can produce a friendly 400).
--   progress  — 0..100 weighted completion, denormalised so list/paged
--               queries never have to walk the tree. Recomputed bottom-up
--               whenever a descendant changes (see TaskProgressService).
--   depth     — cached distance from the root. Purely derived; used for
--               indentation and bottom-up recomputation ordering. NOT a
--               depth limit — nothing in the schema caps it.
--   position  — sibling ordering, for drag & drop reordering.
--
-- Existing `subtasks` rows are migrated into real child tasks so no user
-- data is lost. The legacy table is left in place (empty of meaning) so
-- the change is reversible; the /subtasks REST API keeps working as a
-- thin adapter over depth-1 child tasks.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Some databases still carry a `tasks_status_check` / `tasks_priority_check`
-- from before Flyway managed this schema, scoped to the original
-- TODO/IN_PROGRESS/DONE and LOW/MEDIUM/HIGH vocabulary. No migration here
-- ever defined them (V2 already needed COMPLETED without touching a check
-- constraint), so there's no tracked definition to preserve — replace
-- whatever is there with one that matches the current enums, otherwise the
-- COMPLETED rows this very migration writes below get rejected.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check') THEN
        ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
    END IF;
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'));

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check') THEN
        ALTER TABLE tasks DROP CONSTRAINT tasks_priority_check;
    END IF;
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'));
END $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id BIGINT  NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weight    INTEGER NOT NULL DEFAULT 100;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depth     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position  INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_parent') THEN
        ALTER TABLE tasks
            ADD CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_id)
                REFERENCES tasks (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tasks_weight') THEN
        ALTER TABLE tasks ADD CONSTRAINT ck_tasks_weight CHECK (weight >= 1 AND weight <= 1000000);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tasks_progress') THEN
        ALTER TABLE tasks ADD CONSTRAINT ck_tasks_progress CHECK (progress >= 0 AND progress <= 100);
    END IF;

    -- Cheap first line of defence against the most obvious circular
    -- reference. Deeper cycles are prevented in TaskTreeService.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tasks_parent_not_self') THEN
        ALTER TABLE tasks ADD CONSTRAINT ck_tasks_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_parent          ON tasks (parent_id);
-- Covers "list the roots for this user, newest first" — the default board query.
CREATE INDEX IF NOT EXISTS idx_tasks_user_parent     ON tasks (user_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_position ON tasks (parent_id, position);

-- ---------------------------------------------------------------------
-- Migrate legacy checklist subtasks into real child tasks.
--
-- Weight is split evenly across siblings and sums to exactly 100, with the
-- remainder handed to the earliest siblings. GREATEST(1, …) guards the case
-- of more than 100 siblings, where an even split would round to 0 and
-- violate the weight >= 1 constraint.
-- ---------------------------------------------------------------------
INSERT INTO tasks (title, description, priority, status, user_id, project_id,
                   parent_id, weight, progress, depth, position,
                   actual_minutes, recurrence, created_at, updated_at)
SELECT LEFT(n.title, 150),
       NULL,
       n.priority,
       CASE WHEN n.completed THEN 'COMPLETED' ELSE 'TODO' END,
       n.user_id,
       n.project_id,
       n.parent_task_id,
       GREATEST(1, (100 / n.sibling_count)
                   + CASE WHEN n.rn <= (100 % n.sibling_count) THEN 1 ELSE 0 END),
       CASE WHEN n.completed THEN 100 ELSE 0 END,
       t_depth.depth + 1,
       n.rn - 1,
       0,
       'NONE',
       n.created_at,
       n.created_at
FROM (
    SELECT s.title,
           s.completed,
           s.created_at,
           s.task_id                                                              AS parent_task_id,
           t.user_id,
           t.project_id,
           t.priority,
           COUNT(*) OVER (PARTITION BY s.task_id)                                 AS sibling_count,
           ROW_NUMBER() OVER (PARTITION BY s.task_id ORDER BY s.created_at, s.id)  AS rn
    FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
) n
JOIN tasks t_depth ON t_depth.id = n.parent_task_id
WHERE NOT EXISTS (
    -- Idempotency guard: never duplicate a child that already exists.
    SELECT 1 FROM tasks existing
    WHERE existing.parent_id = n.parent_task_id
      AND existing.title = LEFT(n.title, 150)
);

-- ---------------------------------------------------------------------
-- Backfill the derived columns for every existing row.
-- ---------------------------------------------------------------------

-- 1. depth, straight from the hierarchy.
WITH RECURSIVE tree AS (
    SELECT id, 0 AS d FROM tasks WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, tree.d + 1 FROM tasks c JOIN tree ON c.parent_id = tree.id
)
UPDATE tasks t SET depth = tree.d
FROM tree
WHERE t.id = tree.id AND t.depth <> tree.d;

-- 2. A task with no countable children is simply done or not done.
--    Cancelled children don't count — matching TaskProgressService, which drops
--    them from both sides of the fraction so cancelling a subtask releases its
--    weight to its siblings instead of capping the parent below 100% forever.
UPDATE tasks t
SET progress = CASE WHEN t.status = 'COMPLETED' THEN 100 ELSE 0 END
WHERE NOT EXISTS (
    SELECT 1 FROM tasks c WHERE c.parent_id = t.id AND c.status <> 'CANCELLED'
);

-- 3. Roll the weighted average up, deepest level first, so each parent sees
--    already-final children. Same formula as TaskProgressService:
--        progress = Σ(child.weight × child.progress) / Σ(child.weight)
DO $$
DECLARE
    deepest INTEGER;
    level   INTEGER;
BEGIN
    SELECT COALESCE(MAX(depth), 0) INTO deepest FROM tasks;

    FOR level IN REVERSE deepest..0 LOOP
        UPDATE tasks p
        SET progress = rollup.pct
        FROM (
            SELECT c.parent_id AS id,
                   ROUND(SUM(c.weight::numeric * c.progress) / NULLIF(SUM(c.weight), 0))::int AS pct
            FROM tasks c
            WHERE c.parent_id IS NOT NULL AND c.status <> 'CANCELLED'
            GROUP BY c.parent_id
        ) rollup
        WHERE p.id = rollup.id AND p.depth = level AND p.progress <> rollup.pct;
    END LOOP;
END $$;

COMMENT ON COLUMN tasks.parent_id IS 'Self FK — NULL for a root task. Unlimited nesting depth.';
COMMENT ON COLUMN tasks.weight    IS 'Share of the parent task''s effort. Siblings may not exceed the parent weight.';
COMMENT ON COLUMN tasks.progress  IS 'Denormalised 0..100 weighted completion, rolled up from children.';
COMMENT ON COLUMN tasks.depth     IS 'Cached distance from the root; derived, never a limit.';
COMMENT ON COLUMN tasks.position  IS 'Sibling ordering for drag & drop.';
