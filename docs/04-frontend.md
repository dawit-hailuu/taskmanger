# Frontend — File-by-File Reference

Base path: `frontend/src/`. Angular 21, standalone components (no `NgModule`s), signals for local reactive state, the newer `@if`/`@for` control-flow template syntax, functional guards/interceptors.

---

## Bootstrap files

### `main.ts`
```ts
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```
The actual entry point — boots the standalone root component `App` using the providers in `appConfig`. There is no `platformBrowserDynamic().bootstrapModule(...)` because this project has no `AppModule` at all.

### `index.html`
The single static HTML shell. Loads Google Fonts (Inter + Space Grotesk), sets the page title ("Taskflow — Task Manager") and favicon, and contains just `<app-root></app-root>` — Angular takes over from there.

### `app/app.config.ts`
```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
```
The application-wide dependency injection setup (this is the standalone-app replacement for `AppModule.providers`):
- `provideZoneChangeDetection({ eventCoalescing: true })` — batches multiple change-detection triggers within the same tick for performance.
- `provideRouter(routes)` — installs the Angular Router with the route table from `app.routes.ts`.
- `provideHttpClient(withInterceptors([...]))` — installs `HttpClient` with **both** interceptors, `authInterceptor` first, then `errorInterceptor`. Order matters: `authInterceptor` runs on the way *out* (adds the header before the request is sent) and both run again (in reverse-registered order for the response side, per Angular's interceptor chain semantics) on the way back.

### `app/app.component.ts` (`App`, selector `app-root`)
The root shell:
```ts
readonly showNavbar = computed(() => this.auth.isAuthenticated());
```
Template:
```html
@if (showNavbar()) { <app-navbar /> }
<router-outlet />
```
Renders the navbar only when a user is signed in, then always renders whatever the router currently matches. This is the *entire* layout — there's no separate "authenticated layout" wrapper component; the navbar's visibility is the only structural difference between logged-in and logged-out views.

### `app/app.routes.ts`
The route table:

| Path | Guard | Loads |
|---|---|---|
| `''` | — | redirects to `/dashboard` |
| `/login` | `guestGuard` | `LoginComponent` (lazy `loadComponent`) |
| `/register` | `guestGuard` | `RegisterComponent` (lazy) |
| `/dashboard` | `authGuard` | `DashboardComponent` (lazy) |
| `**` (anything else) | — | redirects to `/dashboard` |

Every feature route is lazily loaded via dynamic `import()`, so `login`/`register`/`dashboard` code only downloads when that route is actually visited.

---

## `core/` — app-wide, non-UI concerns

### `core/models/user.model.ts`
Plain TypeScript interfaces mirroring the backend's auth DTOs 1:1: `User` (`id`, `name`, `email`, `role`), `AuthResponse` (`token`, `tokenType`, `user`), `LoginRequest`, `RegisterRequest`. No classes, no runtime behavior — pure type shapes for compile-time safety.

### `core/models/task.model.ts`
- `Priority` / `TaskStatus` — string literal union types matching the backend enums exactly (`'LOW'|'MEDIUM'|'HIGH'`, `'TODO'|'IN_PROGRESS'|'DONE'`).
- `Task` — mirrors `TaskResponse` from the backend.
- `TaskRequest` — mirrors the backend's `TaskRequest` (used for both create and update calls).
- `TaskQuery` — the shape of list-query parameters (`search`, `status`, `priority`, `page`, `size`, `sortBy`, `direction`), all optional.
- `Page<T>` — mirrors the backend's `PageResponse<T>` envelope.
- `PRIORITY_OPTIONS` / `STATUS_OPTIONS` — ordered arrays used to populate `<select>` dropdowns.
- `STATUS_LABELS` / `PRIORITY_LABELS` — maps from the enum value to its human-readable display label (`'IN_PROGRESS' → 'In progress'`).

### `core/services/auth.service.ts` (`AuthService`, `providedIn: 'root'` — app-wide singleton)
The single source of truth for "who is logged in," backed by `localStorage` under two keys: `taskflow.token`, `taskflow.user`.

- **State:** a private `signal<User | null>` (`_user`), initialized from `readStoredUser()` so a page refresh doesn't lose the session. Exposes it read-only as `user`, plus a derived `computed` `isAuthenticated`.
- **`login(credentials)`** — `POST /auth/login`, and on success (`tap`) calls `storeSession(res)`.
- **`register(payload)`** — `POST /auth/register`, same `storeSession` side effect on success. Both endpoints return the identical `AuthResponse` shape, so registering logs the user in immediately, exactly like login.
- **`logout()`** — clears both `localStorage` keys, resets the `_user` signal to `null`, and navigates to `/login`. Called both from the navbar's "Sign out" button and automatically by `errorInterceptor` on a `401`.
- **`getToken()`** — reads the raw JWT string from `localStorage` (used by `authInterceptor`).
- **`storeSession(res)`** (private) — persists both the token and the user JSON, and updates the `_user` signal — this single method is what makes the UI reactively flip to "logged in" the instant login/register succeeds.
- **`readStoredUser()`** (private) — parses the cached user JSON, defensively returning `null` on any parse failure.

### `core/services/task.service.ts` (`TaskService`, `providedIn: 'root'`)
A thin, stateless HTTP client wrapping `/api/tasks` — no caching, no signals, just methods returning `Observable`s (components own the resulting state themselves):

- **`list(query: TaskQuery)`** — builds an `HttpParams` object from whatever fields are present in `query` (`search`/`status`/`priority` only added if truthy; `page`/`size`/`sortBy`/`direction` always sent with defaults `0`/`9`/`'createdAt'`/`'desc'`), then `GET /api/tasks?...` → `Page<Task>`.
- **`get(id)`** — `GET /api/tasks/{id}` → `Task`.
- **`create(payload: TaskRequest)`** — `POST /api/tasks` → `Task`.
- **`update(id, payload: TaskRequest)`** — `PUT /api/tasks/{id}` → `Task`.
- **`delete(id)`** — `DELETE /api/tasks/{id}` → `void`.

Note this service never manually attaches the `Authorization` header or the base URL host beyond `environment.apiUrl` — that's the interceptors' job (base path) and `authInterceptor`'s job (auth header).

### `core/guards/auth.guard.ts`
Two functional route guards (`CanActivateFn`), both reading `AuthService.isAuthenticated()`:
- **`authGuard`** — allows navigation if authenticated; otherwise redirects to `/login` (via `router.createUrlTree`, the idiomatic non-imperative-navigation way to redirect from a guard). Applied to `/dashboard`.
- **`guestGuard`** — the inverse: allows navigation only if **not** authenticated; otherwise redirects to `/dashboard`. Applied to `/login` and `/register` so an already-logged-in user can't see the login/register forms again.

### `core/interceptors/auth.interceptor.ts`
```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(req);
};
```
Attaches the bearer token to literally every outgoing HTTP request if one exists in storage — including calls to `/auth/login`/`/auth/register` (harmless there since those endpoints ignore the header; they're `permitAll()` on the backend).

### `core/interceptors/error.interceptor.ts`
Centralizes HTTP error handling for the whole app:
- Catches every `HttpErrorResponse`.
- If the status is `401` **and** the failing request wasn't itself an `/auth/...` call (so a wrong-password login attempt doesn't trigger a forced logout loop), calls `auth.logout()` — this is what makes an expired/invalid JWT transparently kick the user back to the login screen on their very next API call.
- Always re-throws a normalized plain `Error` (via `normalize()`) so components never have to know about `HttpErrorResponse`'s shape:
  - If the backend's `ApiError.fieldErrors` is non-empty, uses the **first** field error as `"{field}: {message}"`.
  - Else if there's a top-level `message`, uses that directly.
  - Else if `status === 0` (the browser couldn't even reach the server — CORS failure, backend down, network error), returns `"Cannot reach the server. Is the backend running?"`.
  - Otherwise, a generic fallback message.

---

## `features/auth/` — login & register pages

### `features/auth/login/login.component.ts` (`LoginComponent`)
Standalone component, `ReactiveFormsModule` + `RouterLink`. Reactive form with `email` (required + email format) and `password` (required) controls. Local `signal`s: `loading`, `error`.
- **`invalid(control)`** — true if the control fails validation *and* has been touched/modified (avoids showing errors before the user interacts with a field).
- **`submit()`** — if the form is invalid, marks all controls touched (forces error text to show) and bails. Otherwise sets `loading = true`, clears `error`, calls `auth.login(...)`; on success navigates to `/dashboard`; on error, sets `error` to `err.message` (the normalized message from `errorInterceptor`) and resets `loading`.

The template includes an inline `<style>` block defining the auth-card layout, brand mark (the three colored "priority ticks" that are the app's visual signature), and error/alert styling — all scoped to this component via Angular's component styles.

### `features/auth/register/register.component.ts` (`RegisterComponent`)
Structurally identical to `LoginComponent`, with an additional `name` field (required, min length 2) and a password minimum length of 6. Calls `auth.register(...)` instead of `login(...)`; same success/error handling pattern.

---

## `features/dashboard/` — the main app screen

### `features/dashboard/dashboard.component.ts` (`DashboardComponent`)
The task list page — by far the largest component, holding most of the app's interactive state.

**State (all `signal`s):**
`tasks: Task[]`, `loading`, `error`, `totalElements`, `totalPages`, `page` (0-indexed), `search`, `statusFilter`, `priorityFilter`, `sortValue` (a combined `"field-direction"` string like `"dueDate-asc"`), `showForm` (modal visibility), `editingTask` (the task being edited, or `null` for "creating new").

**Derived (`computed`):** `hasTasks` (`tasks().length > 0`), `isFiltered` (true if search/status/priority has any active value — drives the "Clear filters" button and empty-state messaging).

**Key methods:**
- **`ngOnInit()`** → calls `load()` once on mount.
- **`load()`** — sets `loading`, splits `sortValue()` on `'-'` into `sortBy`/`direction`, calls `taskService.list({...})` with the current filter/sort/page state, and on success populates `tasks`/`totalElements`/`totalPages`; on error sets `error` to the message.
- **`onSearchInput(value)`** — **debounced search**: updates the `search` signal immediately (so the input stays responsive) but delays the actual `load()` call by 300ms via `setTimeout`, clearing any pending timer first — a manual debounce without RxJS, since the search box isn't wired through an `Observable` pipeline.
- **`onStatusChange` / `onPriorityChange` / `onSortChange`** — update the relevant signal, reset `page` to 0 (changing a filter always returns to page 1), and reload immediately (no debounce needed for discrete `<select>` changes).
- **`clearFilters()`** — resets every filter/sort signal to its default and reloads.
- **`prev()` / `next()`** — decrement/increment `page` (bounds-checked) and reload.
- **`openCreate()` / `openEdit(task)` / `closeForm()`** — control the modal: `openCreate` clears `editingTask` and shows the form; `openEdit` sets `editingTask` to the clicked task and shows the form; `closeForm` hides it and clears `editingTask`.
- **`onSaved(payload: TaskRequest)`** — the `(saved)` event handler from `<app-task-form>`. If `editingTask()` is set, calls `taskService.update(id, payload)`; otherwise `taskService.create(payload)`. Either way, on success closes the form and reloads the list; on error, sets `error` and still closes the form.
- **`deleteTask(task)`** — uses the browser's native `confirm()` dialog before calling `taskService.delete(task.id)`. On success, if the just-deleted task was the *only* item on a page beyond the first, steps `page` back by one (so you don't land on an empty page after deleting the last item on it), then reloads.
- **Display helpers** — `priorityLabel`/`statusLabel` (lookup into the shared label maps), `spineClass`/`priorityBadgeClass`/`statusBadgeClass` (map an enum value to a CSS class name for the colored left-border "priority spine" and badges), `formatDate` (locale-formatted date string from an ISO date), `isOverdue` (true if `dueDate` is in the past **and** status isn't `DONE` — drives the red "Overdue" label).

**Template structure:** page header (title + task count + "New task" button) → toolbar (search input, status/priority/sort `<select>`s, conditional "Clear" button) → conditional states (`loading` / empty / populated) → a responsive card grid of tasks (each showing a priority-colored left border, priority + status badges, title, truncated description, due-date/overdue text, edit/delete buttons) → pagination controls (only shown if more than one page) → the modal form, rendered conditionally via `@if (showForm())`.

### `features/dashboard/task-form.component.ts` (`TaskFormComponent`)
The create/edit modal, used by `DashboardComponent` via `<app-task-form [task]="editingTask()" (saved)="..." (cancelled)="...">`.

- **Inputs/outputs (signal-based, the newer Angular API):** `task = input<Task | null>(null)` (the task to edit, or `null` to create), `saved = output<TaskRequest>()`, `cancelled = output<void>()`.
- **`isEdit`** — a `computed` off a private `_isEdit` signal, set in `ngOnInit` based on whether `task()` was provided.
- **`ngOnInit()`** — if editing an existing task, patches the reactive form with its current values (falling back to `''` for `null` description/dueDate, since HTML `<input>`/`<textarea>` can't bind to `null`).
- **Form fields:** `title` (required, max 150), `description` (no validators — optional), `priority` (default `'MEDIUM'`), `status` (default `'TODO'`), `dueDate` (plain string, bound to an `<input type="date">`).
- **`submit()`** — validates; if invalid, marks all touched and bails. Otherwise trims `title`/`description`, converts an empty trimmed description or empty `dueDate` string to `null` (so the backend sees `null` rather than `""`), and emits the resulting `TaskRequest` via `saved.emit(payload)` — note this component **does not call `TaskService` itself**; it only builds the payload and lets the parent (`DashboardComponent`) decide whether that's a create or an update.
- **`onCancel()`** — emits `cancelled`.
- **`@HostListener('document:keydown.escape') onEscape()`** — closes the modal on the `Escape` key, calling `onCancel()`.
- The template is a modal overlay (click-outside-to-close via `(click)="onCancel()"` on the overlay combined with `(click)="$event.stopPropagation()"` on the dialog itself, so clicks inside the dialog don't bubble up and close it).

---

## `shared/navbar/navbar.component.ts` (`NavbarComponent`)
The sticky top bar, rendered only when a user is authenticated (per `App`'s `showNavbar` check).
- **`user`** — directly re-exposes `AuthService.user` (the read-only signal) — no local state duplication.
- **`logout()`** — delegates straight to `AuthService.logout()`.
- **`initial(name)`** — returns the uppercased first character of the user's name for the circular avatar badge, falling back to `'?'` for an empty name.
- Template shows the "Taskflow" brand mark (the same three-tick motif as the auth pages), and, if a user is present, their name + email + avatar initial + a "Sign out" button.

---

## `environments/`

- **`environment.ts`** (used for production builds) and **`environment.development.ts`** (used by `ng serve`) — both currently define the same `apiUrl: 'http://localhost:8080/api'`; only `production` differs (`true` vs `false`). Every service (`AuthService`, `TaskService`) imports `environment` from `../../../environments/environment` and Angular's build system swaps in the development file automatically during `ng serve` via the `fileReplacements` configured in `angular.json`.

## Styling notes
Nearly every component defines its own scoped `styles: [...]` array (Angular's per-component CSS encapsulation) rather than relying on a shared stylesheet, but all reference the same set of CSS custom properties (`--high`, `--med`, `--low`, `--muted`, `--border`, `--surface`, `--brand-tint`, etc.) — these are defined globally in `src/styles.css`, giving the app one consistent color system (the "priority spine" color coding, card shadows, etc.) without duplicating actual color values in every component.
