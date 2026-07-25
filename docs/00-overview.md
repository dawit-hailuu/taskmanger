# Taskflow — Project Overview

Taskflow is a full-stack task-management application: a **Spring Boot 3.4 (Java 21)** REST API backed by **PostgreSQL 16**, with an **Angular 21** single-page application as the client. Users register an account, sign in, and manage a personal list of tasks (create, edit, delete, search, filter, sort, paginate). Every task belongs to exactly one user, and the API enforces that a user can only ever see or modify their own tasks.

This documentation set explains the entire codebase file-by-file, folder-by-folder, so that you can understand how the system works end-to-end without reading the source.

## Documentation map

| File | Covers |
|---|---|
| [01-architecture.md](01-architecture.md) | High-level system architecture, layering, request lifecycle, folder structure |
| [02-database.md](02-database.md) | PostgreSQL schema, tables, columns, indexes, relationships |
| [03-backend.md](03-backend.md) | Every backend Java file: classes, methods, responsibilities |
| [04-frontend.md](04-frontend.md) | Every frontend Angular file: components, services, guards, interceptors |
| [05-auth-flow.md](05-auth-flow.md) | Registration/login/JWT verification, step by step, across both layers |
| [06-api-reference.md](06-api-reference.md) | Every REST endpoint: method, path, params, request/response bodies, status codes |
| [07-data-flow.md](07-data-flow.md) | Full request traces for key user actions (login, list tasks, create/edit/delete task) |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 — standalone components, signals, functional guards/interceptors, TypeScript |
| Backend | Spring Boot 3.4, Spring Security, Spring Data JPA (Hibernate) |
| Auth | JWT (`jjwt` 0.12.6), BCrypt password hashing |
| Database | PostgreSQL 16 |
| Build tools | Maven (backend), Angular CLI / Vite (frontend) |

## Top-level project structure

```
task-management-system/
├── backend/                     Spring Boot REST API (Java, Maven)
│   ├── pom.xml                  Maven build file — dependencies, plugins
│   └── src/main/
│       ├── java/com/taskmanager/
│       │   ├── auth/            Registration & login: controller, service, DTOs
│       │   ├── task/            Task entity, repository, service, controller, specs, DTOs
│       │   ├── user/            User entity (also a Spring Security UserDetails), repo, /users/me
│       │   ├── security/        JwtService, JWT filter, 401 entry point, UserDetailsService
│       │   ├── config/          SecurityConfig — CORS, filter chain, security beans
│       │   ├── exception/       GlobalExceptionHandler, ApiError, custom exceptions
│       │   └── TaskManagerApplication.java   Spring Boot entry point
│       └── resources/application.yml   All runtime configuration
├── frontend/                    Angular 21 SPA
│   └── src/
│       ├── app/
│       │   ├── core/            models, services (HTTP clients), guards, interceptors
│       │   ├── features/
│       │   │   ├── auth/        login, register page components
│       │   │   └── dashboard/   task list dashboard + create/edit modal form
│       │   ├── shared/navbar/   top navigation bar
│       │   ├── app.component.ts   root shell component
│       │   ├── app.config.ts      application-wide providers (router, HTTP client, interceptors)
│       │   └── app.routes.ts      route table
│       ├── environments/        API base URL per build environment
│       ├── main.ts              bootstraps the Angular app
│       └── index.html           HTML shell
└── database/schema.sql          Reference DDL (Hibernate also auto-creates this at runtime)
```

## Big picture, in one paragraph

The Angular SPA runs entirely in the browser and talks to the Spring Boot API over HTTP/JSON at `http://localhost:8080/api`. Every outgoing request from the frontend passes through an `authInterceptor` that attaches a JWT (if the user is logged in) and an `errorInterceptor` that normalizes error responses and force-logs-out on 401. On the backend, every incoming request passes through a `JwtAuthenticationFilter` that reads that same JWT, verifies it, and — if valid — populates Spring Security's context with the authenticated `User`. Controllers use `@AuthenticationPrincipal User user` to get the current user directly, and every task query/mutation is scoped to `user.getId()`, so tasks are always partitioned per-owner both at the query level (`TaskSpecifications.ownedBy`) and the single-record level (`TaskRepository.findByIdAndUserId`). Data is persisted via Spring Data JPA to two PostgreSQL tables, `users` and `tasks`, related by a foreign key with `ON DELETE CASCADE`.
