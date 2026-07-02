-- =====================================================================
-- Task Management System - MySQL schema (reference)
-- ---------------------------------------------------------------------
-- The application uses Hibernate `ddl-auto: update`, so these tables are
-- created automatically on first startup. This file documents the schema
-- explicitly and can be used to provision the database manually if you
-- prefer `ddl-auto: validate` in production.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS task_manager
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE task_manager;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL,
    password    VARCHAR(255) NOT NULL,          -- BCrypt hash
    role        VARCHAR(20)  NOT NULL DEFAULT 'ROLE_USER',
    created_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    title        VARCHAR(150) NOT NULL,
    description  TEXT         NULL,
    priority     VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',   -- LOW | MEDIUM | HIGH
    status       VARCHAR(20)  NOT NULL DEFAULT 'TODO',     -- TODO | IN_PROGRESS | DONE
    due_date     DATE         NULL,
    user_id      BIGINT       NOT NULL,
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_tasks_user (user_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_priority (priority),
    INDEX idx_tasks_due_date (due_date)
) ENGINE = InnoDB;
