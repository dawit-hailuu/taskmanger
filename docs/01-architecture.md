# Architecture

## Layered design (backend)

The backend follows a conventional Spring Boot layering, organized **by feature package** (`auth`, `task`, `user`) rather than by technical layer, with cross-cutting concerns split into their own packages (`security`, `config`, `exception`):

```
Controller  →  Service  →  Repository  →  Database
  (HTTP)      (business logic)  (Spring Data JPA)   (PostgreSQL)
```

- **Controllers** (`AuthController`, `TaskController`, `UserController`) are thin: they validate input (`@Valid`), delegate to a service, and wrap the result in a `ResponseEntity` with the right HTTP status.
- **Services** (`AuthService`, `TaskService`) hold business logic: password hashing, JWT issuance, ownership checks, query building, whitelisting sortable fields.
- **Repositories** (`TaskRepository`, `UserRepository`) are Spring Data JPA interfaces — no implementation code, just method signatures Spring generates queries for.
- **Entities** (`Task`, `User`) are JPA-mapped classes that also double as domain objects; `User` additionally implements Spring Security's `UserDetails`.

Cutting across all of this:
- **`security/`** — JWT creation/verification and the servlet filter that runs on every request.
- **`config/SecurityConfig`** — wires the above into Spring Security's filter chain, plus CORS and password encoding.
- **`exception/`** — a single `@RestControllerAdvice` (`GlobalExceptionHandler`) that converts every exception type the app throws into a consistent JSON `ApiError` body.

## Layered design (frontend)

Angular's structure mirrors a typical "core/features/shared" convention:

```
core/            — singleton, app-wide concerns (not UI)
  models/        — TypeScript interfaces mirroring backend DTOs
  services/      — HTTP clients wrapping backend endpoints (AuthService, TaskService)
  guards/        — route access control (authGuard, guestGuard)
  interceptors/  — cross-cutting HTTP behavior (attach JWT, normalize errors)

features/        — route-level pages, each self-contained
  auth/login, auth/register
  dashboard/      — the task list page + the create/edit modal

shared/           — reusable UI used across features (navbar)
```

Every component is a **standalone component** (no `NgModule`s) using Angular's newer control-flow syntax (`@if`, `@for`) and **signals** for reactive local state instead of RxJS `BehaviorSubject`s. Routes are lazy-loaded via `loadComponent()`.

## Request lifecycle (end-to-end)

1. A component (e.g. `DashboardComponent`) calls a **service** method (e.g. `TaskService.list()`), which returns an RxJS `Observable` wrapping an Angular `HttpClient` call.
2. The request passes through Angular's interceptor chain, in order:
   - `authInterceptor` — reads the JWT from `AuthService.getToken()` (backed by `localStorage`) and, if present, adds header `Authorization: Bearer <token>`.
   - `errorInterceptor` — passes the request through; on the way back, catches HTTP errors, and if the origin app is authenticated but the response is `401`, calls `auth.logout()` (clears session, redirects to `/login`). It also converts the backend's JSON error shape into a plain `Error` with a human-readable `.message`.
3. The request crosses the network to `http://localhost:8080/api/...`.
4. On the backend, Spring's servlet filter chain runs. Relevant filters, in order:
   - CORS handling (configured in `SecurityConfig.corsConfigurationSource()`).
   - **`JwtAuthenticationFilter`** (registered before `UsernamePasswordAuthenticationFilter`) — reads the `Authorization` header, verifies the JWT via `JwtService`, loads the `User` via `AppUserDetailsService`, and if valid, sets `SecurityContextHolder`'s `Authentication` to that user. If the header is missing/invalid, it just continues the chain unauthenticated (no exception thrown here).
   - Spring Security's authorization check (`authorizeHttpRequests`) — `/api/auth/**` and `/actuator/health` are public; everything else requires an authenticated principal. If unauthenticated, `JwtAuthenticationEntryPoint` returns a `401` JSON `ApiError` immediately (short-circuiting before the controller runs).
5. The matched **`@RestController`** method executes. It reads the authenticated `User` via `@AuthenticationPrincipal User user` (Spring Security injects the `Authentication.getPrincipal()`, which — because `JwtAuthenticationFilter` set the principal to a `User` object — is the actual JPA entity).
6. The controller calls a **service** method, passing the `User` in so that all queries/mutations are scoped to that user's `id`.
7. The service uses a **repository** (plain CRUD, or a `Specification` for dynamic queries) to talk to PostgreSQL via Hibernate.
8. The service returns a JPA entity (or a `Page` of them); the controller maps it to a DTO (`TaskResponse`, `UserResponse`, etc. — records with a static `from(...)` factory) before returning it, so entities (and fields like the password hash) never leak into JSON responses.
9. If anything throws along the way, `GlobalExceptionHandler` intercepts it and returns a consistent `ApiError` JSON body with the right HTTP status.
10. The response flows back through the Angular interceptors (error normalization if it's an error) and into the component, which updates its `signal`s, causing the template to re-render.

## Statelessness

There are no server-side sessions. `SecurityConfig` sets `SessionCreationPolicy.STATELESS`; every request must carry its own JWT. The frontend persists the JWT and the last-known user object in `localStorage` (`taskflow.token`, `taskflow.user`) so a page refresh doesn't log the user out — `AuthService` seeds its `user` signal from `localStorage` on construction.
