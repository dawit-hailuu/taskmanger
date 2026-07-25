-- =====================================================================
-- V2 — Expand task status vocabulary and role set
-- ---------------------------------------------------------------------
-- Status and priority are stored as VARCHAR (Hibernate EnumType.STRING),
-- so widening the enums needs no DDL — only a data migration for the one
-- renamed value:  DONE  ->  COMPLETED.
--
-- New (app-level) values introduced alongside this migration:
--   Priority   : + URGENT
--   TaskStatus : + REVIEW, COMPLETED (was DONE), + CANCELLED
--   Role       : + ROLE_MANAGER
-- =====================================================================

UPDATE tasks SET status = 'COMPLETED' WHERE status = 'DONE';
