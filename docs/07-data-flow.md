# Data Flow — Full Traces of Key User Actions

Each trace lists every file involved, in the order execution actually touches them.

## A. Loading the dashboard after login

1. `authGuard` (`core/guards/auth.guard.ts`) allows navigation to `/dashboard` because `AuthService.isAuthenticated()` is true.
2. `app.routes.ts` lazy-loads `DashboardComponent`.
3. `DashboardComponent.ngOnInit()` → `load()`.
4. `load()` calls `TaskService.list({ search: '', status: '', priority: '', page: 0, size: 9, sortBy: 'createdAt', direction: 'desc' })`.
5. `TaskService.list()` (`core/services/task.service.ts`) builds `HttpParams` and issues `GET /api/tasks?page=0&size=9&sortBy=createdAt&direction=desc`.
6. `authInterceptor` attaches `Authorization: Bearer <token>`.
7. Request reaches Spring: `JwtAuthenticationFilter` validates the token and populates `SecurityContextHolder` with the `User` principal.
8. `TaskController.list(@AuthenticationPrincipal User user, ...)` receives the call.
9. `TaskController` calls `TaskService.search(user, null, null, null, 0, 9, "createdAt", "desc")`.
10. `TaskService.search()` builds `Specification<Task> = TaskSpecifications.ownedBy(user.getId())` (no keyword/status/priority filters supplied), builds a safe `Pageable` via `buildPageable()`, and calls `taskRepository.findAll(spec, pageable)`.
11. `TaskRepository` (Spring Data JPA) translates the `Specification` + `Pageable` into a SQL query: `SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 9 OFFSET 0` (plus a `COUNT(*)` query for `totalElements`).
12. Hibernate maps result rows back into `Task` entities.
13. `TaskController` wraps the returned `Page<Task>` via `PageResponse.from(page, TaskResponse::from)`, converting every `Task` entity to a password-free... (well, task has no password) — a client-safe `TaskResponse` DTO, and copying pagination metadata.
14. Response serializes to JSON, flows back through `errorInterceptor` (no-op on success) to `TaskService.list()`'s `Observable`.
15. `DashboardComponent.load()`'s `.subscribe({ next })` fires: `tasks.set(result.content)`, `totalElements.set(...)`, `totalPages.set(...)`, `loading.set(false)`.
16. Angular's change detection re-renders the `@for (task of tasks(); ...)` grid.

## B. Creating a task

1. User clicks "+ New task" → `DashboardComponent.openCreate()` → `editingTask.set(null)`, `showForm.set(true)`.
2. Template's `@if (showForm())` renders `<app-task-form [task]="editingTask()" ...>` — `task` input is `null`, so `TaskFormComponent.ngOnInit()` leaves the form at its defaults (`priority: 'MEDIUM'`, `status: 'TODO'`) and sets `_isEdit` to `false`.
3. User fills the form and submits → `TaskFormComponent.submit()` validates, builds a `TaskRequest` payload (trimming strings, converting empty description/dueDate to `null`), and calls `saved.emit(payload)`.
4. `DashboardComponent.onSaved(payload)` fires (bound via `(saved)="onSaved($event)"`). Since `editingTask()` is `null`, it calls `taskService.create(payload)`.
5. `TaskService.create()` issues `POST /api/tasks` with the JSON body.
6. Same interceptor/filter/security path as trace A steps 6–8.
7. `TaskController.create(@AuthenticationPrincipal User user, @Valid @RequestBody TaskRequest request)`. `@Valid` triggers Bean Validation on `TaskRequest` first — a validation failure short-circuits here into a `400` with `fieldErrors`, never reaching the service.
8. `TaskController` calls `TaskService.create(user, request)`.
9. `TaskService.create()` builds a `Task` via its `Builder`, setting `.user(owner)` — this is the ownership assignment — and calls `taskRepository.save(task)`.
10. Hibernate `INSERT`s the row; `@CreatedDate`/`@LastModifiedDate` auto-populate `createdAt`/`updatedAt` via the `AuditingEntityListener`.
11. `TaskController` returns `201 Created` + `TaskResponse.from(created)`.
12. Back in Angular, `DashboardComponent.onSaved()`'s `.subscribe({ next })` fires: `closeForm()` (hides the modal) then `load()` (refetches the current page so the new task appears, sorted per the active sort — since sort defaults to newest-first, a new task typically appears at the top of page 1).

## C. Editing a task

Same as trace B, except:
- `DashboardComponent.openEdit(task)` sets `editingTask.set(task)` before showing the form.
- `TaskFormComponent.ngOnInit()` detects `task()` is non-null, sets `_isEdit` to `true`, and `patchValue`s the form with the existing task's fields.
- On submit, `DashboardComponent.onSaved()` sees `editingTask()` is non-null and calls `taskService.update(editing.id, payload)` → `PUT /api/tasks/{id}`.
- `TaskController.update()` → `TaskService.update(user, id, request)` → **`getOwnedTask(owner, id)` first** (re-verifying ownership via `findByIdAndUserId`, throwing `404` if the task isn't the caller's), *then* overwrites every mutable field and saves. `updatedAt` refreshes automatically.

## D. Deleting a task

1. User clicks "Delete" on a task card → `DashboardComponent.deleteTask(task)`.
2. Browser's native `confirm()` dialog — if cancelled, nothing happens.
3. If confirmed, `taskService.delete(task.id)` → `DELETE /api/tasks/{id}`.
4. `TaskController.delete()` → `TaskService.delete(user, id)` → `getOwnedTask(owner, id)` (ownership check, `404` if not the caller's) → `taskRepository.delete(task)`.
5. Response: `204 No Content`.
6. Frontend: if the deleted task was the last one visible on a page beyond the first, `page` steps back by one; either way, `load()` refetches.

## E. Search-as-you-type

1. User types in the search box → `(input)="onSearchInput($any($event.target).value)"`.
2. `DashboardComponent.onSearchInput(value)` immediately sets `search.set(value)` (so the input box itself never lags), clears any pending debounce timer, and starts a new 300ms `setTimeout`.
3. When the timer fires (assuming no further keystrokes reset it), `page.set(0)` and `load()` runs.
4. `load()` sends `GET /api/tasks?search=<value>&...`.
5. `TaskService.search()` (backend) sees a non-blank `keyword` and adds `TaskSpecifications.matchesKeyword(keyword.trim())` to the `Specification`, producing SQL roughly: `WHERE user_id = ? AND (LOWER(title) LIKE '%keyword%' OR LOWER(description) LIKE '%keyword%')`.
6. Results render exactly like trace A.

## F. What happens across an entire session as the JWT nears expiry

1. Token is issued at login with a 24h lifetime (`app.jwt.expiration-ms`).
2. Every subsequent request re-validates the token fresh via `JwtAuthenticationFilter` — there is no concept of "refreshing" a token; it's valid until its `exp` claim passes.
3. The frontend keeps using the same cached token from `localStorage` for every request during that window — `AuthService` never re-derives or refreshes it.
4. The instant a request is made *after* expiry, `JwtService.isTokenExpired()` returns `true` inside the filter, the security context stays unauthenticated, `JwtAuthenticationEntryPoint` returns `401`, and `errorInterceptor` on the frontend calls `auth.logout()`, clearing storage and redirecting to `/login`. The user must sign in again to get a new 24h token.

## G. Cross-user isolation, concretely

Suppose User A (`id=1`) and User B (`id=2`) are both logged in (two different tokens). If User B tries `GET /api/tasks/{A's task id}`:
1. `JwtAuthenticationFilter` authenticates the request as User B (their own valid token → their own `User` principal).
2. `TaskController.getById(@AuthenticationPrincipal User user /* = User B */, @PathVariable Long id /* = A's task id */)`.
3. `TaskService.getOwnedTask(userB, id)` → `taskRepository.findByIdAndUserId(id, userB.getId())` — the SQL is `WHERE id = ? AND user_id = ?`, and since that task's `user_id` is `1` not `2`, **no row matches**, regardless of the task existing.
4. `Optional.empty()` → `ResourceNotFoundException` → `404`, identical to the response for a truly nonexistent ID.

This is the core security invariant of the whole task feature: ownership is enforced **at the SQL query level**, not just by filtering results after the fact — there's no code path that fetches a task by ID alone.
