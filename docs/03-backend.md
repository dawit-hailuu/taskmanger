# Backend — File-by-File Reference

Base package: `com.taskmanager`. All paths below are relative to `backend/src/main/java/com/taskmanager/`.

---

## `TaskManagerApplication.java`

The Spring Boot entry point.

```java
@SpringBootApplication
@EnableJpaAuditing
public class TaskManagerApplication {
    public static void main(String[] args) {
        SpringApplication.run(TaskManagerApplication.class, args);
    }
}
```

- `@SpringBootApplication` enables auto-configuration and component scanning across `com.taskmanager` and its sub-packages — this is why every `@Service`, `@Component`, `@RestController`, `@Configuration`, and `@Repository` in the other packages is picked up automatically without manual registration.
- `@EnableJpaAuditing` turns on `@CreatedDate` / `@LastModifiedDate` support, used by `Task` and `User`.

---

## `auth/` — registration & login

### `AuthController.java`
`@RestController` at `/api/auth`. Two endpoints, both public (see `SecurityConfig`):

| Method | Path | Body | Behavior |
|---|---|---|---|
| `POST` | `/api/auth/register` | `RegisterRequest` | Validates with `@Valid`, delegates to `AuthService.register()`, returns `201 Created` with an `AuthResponse` |
| `POST` | `/api/auth/login` | `LoginRequest` | Validates, delegates to `AuthService.login()`, returns `200 OK` with an `AuthResponse` |

Purely a thin HTTP adapter — no business logic lives here.

### `AuthService.java`
The business logic for authentication.

- **`register(RegisterRequest request)`** — checks `userRepository.existsByEmail(...)`; if taken, throws `EmailAlreadyExistsException` (→ mapped to `409 Conflict` by the global handler). Otherwise builds a `User` via its builder, hashing the password with the injected `PasswordEncoder` (BCrypt), assigns `Role.ROLE_USER`, saves it, generates a JWT via `JwtService.generateToken(saved)`, and returns `AuthResponse.of(token, saved)`. Annotated `@Transactional`.
- **`login(LoginRequest request)`** — delegates authentication to Spring Security's `AuthenticationManager` by constructing a `UsernamePasswordAuthenticationToken(email, password)` and calling `.authenticate(...)`. Under the hood this invokes `DaoAuthenticationProvider`, which uses `AppUserDetailsService` to load the user by email and `PasswordEncoder` to check the password hash. If credentials are wrong, Spring throws `BadCredentialsException` (→ mapped to `401` globally). On success, the returned `Authentication.getPrincipal()` **is** the `User` entity (because `User implements UserDetails`), so it's cast directly, a JWT is generated, and an `AuthResponse` returned.

Both methods return the same shape (`AuthResponse`) so the frontend treats register and login identically — either way you end up logged in immediately with a token.

### `auth/dto/` — data transfer objects (all Java `record`s, i.e. immutable value objects)

| File | Fields | Purpose |
|---|---|---|
| `RegisterRequest.java` | `name` (2–100 chars), `email` (valid, ≤150 chars), `password` (6–100 chars) | Inbound payload for `/register`, validated via Bean Validation annotations (`@NotBlank`, `@Size`, `@Email`) |
| `LoginRequest.java` | `email`, `password` (both `@NotBlank`) | Inbound payload for `/login` |
| `UserResponse.java` | `id`, `name`, `email`, `role` | Password-free view of a `User`, built via static factory `UserResponse.from(User)` |
| `AuthResponse.java` | `token`, `tokenType` (always `"Bearer"`), `user: UserResponse` | Returned by both register and login; built via `AuthResponse.of(token, user)` |

The validation messages (e.g. `"Password must be between 6 and 100 characters"`) are exactly what ends up in the API's `ApiError.fieldErrors[]` and, ultimately, in the Angular form's inline error text.

---

## `task/` — the core domain

### `Task.java` (JPA entity, table `tasks`)
Fields: `id`, `title`, `description`, `priority` (`Priority` enum, default `MEDIUM`), `status` (`TaskStatus` enum, default `TODO`), `dueDate` (`LocalDate`), `user` (`@ManyToOne` to `User`, lazy, required), `createdAt`/`updatedAt` (`Instant`, auto-managed). Uses a `Builder` static inner class instead of Lombok (the whole codebase avoids Lombok, writing getters/setters/builders by hand). Declares four `@Index` entries mirroring `schema.sql`.

### `Priority.java` / `TaskStatus.java`
Plain enums:
```java
enum Priority { LOW, MEDIUM, HIGH }
enum TaskStatus { TODO, IN_PROGRESS, DONE }
```
Persisted as strings (`@Enumerated(EnumType.STRING)` on the entity). Used directly as Spring MVC `@RequestParam` types in `TaskController` — Spring auto-converts the query string (e.g. `?status=DONE`) to the enum constant, returning a `400` (via `MethodArgumentTypeMismatchException` → `GlobalExceptionHandler`) if the value doesn't match.

### `TaskRepository.java`
```java
interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {
    Optional<Task> findByIdAndUserId(Long id, Long userId);
}
```
- `JpaRepository` gives standard CRUD (`save`, `findById`, `delete`, etc.) for free.
- `JpaSpecificationExecutor` enables `findAll(Specification<Task>, Pageable)` — the dynamic-query mechanism used for search/filter/sort/paginate.
- `findByIdAndUserId` is the **ownership-enforcing single-record lookup**: Spring Data derives the query from the method name (`WHERE id = ? AND user_id = ?`). This is the mechanism that guarantees a user can never fetch, edit, or delete another user's task by guessing an ID.

### `TaskSpecifications.java`
A non-instantiable utility class (private constructor) of static `Specification<Task>` factories, combined with `.and(...)` in the service layer:
- `ownedBy(Long userId)` — `WHERE user.id = :userId`. Applied unconditionally on every list query.
- `matchesKeyword(String keyword)` — case-insensitive `LIKE '%keyword%'` against **both** `title` and `description`, OR'd together.
- `hasStatus(TaskStatus status)` / `hasPriority(Priority priority)` — simple equality filters, added only when the caller supplied that query param.

This is the Spring Data JPA Criteria API in its idiomatic form: each `Specification` is a lambda `(root, query, cb) -> Predicate`, composed at runtime instead of writing many overloaded repository methods.

### `TaskService.java`
The business/query logic:
- **`SORTABLE_FIELDS`** — a hardcoded `Set` (`createdAt`, `updatedAt`, `dueDate`, `priority`, `status`, `title`) used to **whitelist** the `sortBy` query param — this prevents arbitrary/unsafe property names from being passed straight into a `Sort.by(...)`, an important defensive-coding detail since `sortBy` comes straight from user input.
- **`search(...)`** — builds a `Specification<Task>` starting from `ownedBy(owner.getId())` and conditionally AND-ing in keyword/status/priority filters, builds a safe `Pageable` (see `buildPageable`), and calls `taskRepository.findAll(spec, pageable)`. `@Transactional(readOnly = true)`.
- **`getOwnedTask(User owner, Long id)`** — calls `findByIdAndUserId`; throws `ResourceNotFoundException` (→ `404`) if not found *or not owned by this user* — from the client's point of view, someone else's task simply doesn't exist.
- **`create(User owner, TaskRequest request)`** — builds a new `Task` from the request fields plus the injected `owner`, saves it. `@Transactional`.
- **`update(User owner, Long id, TaskRequest request)`** — loads via `getOwnedTask` (so ownership is re-checked on every update), then overwrites all mutable fields and saves. Full-replace semantics (like a `PUT`, not a partial `PATCH`).
- **`delete(User owner, Long id)`** — loads via `getOwnedTask`, then deletes.
- **`buildPageable(int page, int size, String sortBy, String direction)`** — clamps `size` to `[1, 100]` and `page` to `≥ 0`, falls back to `createdAt` if `sortBy` isn't in the whitelist, and defaults `direction` to `DESC` unless it's exactly `"asc"` (case-insensitive).
- **`sortableFields()`** — a static helper exposing the whitelist (used by tests / potentially a future "available sort fields" endpoint).

### `TaskController.java`
`@RestController` at `/api/tasks`. Every method takes `@AuthenticationPrincipal User user` as its first parameter — this is how the controller gets "the current logged-in user" without ever touching `SecurityContextHolder` directly; Spring Security resolves it from the authenticated principal set by `JwtAuthenticationFilter`.

| Method | Path | Params / Body | Behavior |
|---|---|---|---|
| `GET` | `/api/tasks` | query: `search`, `status`, `priority`, `page` (default 0), `size` (default 10), `sortBy` (default `createdAt`), `direction` (default `desc`) | Calls `TaskService.search(...)`, wraps the resulting `Page<Task>` in a `PageResponse<TaskResponse>` via `PageResponse.from(result, TaskResponse::from)` |
| `GET` | `/api/tasks/{id}` | — | `TaskService.getOwnedTask` → `TaskResponse.from(...)` |
| `POST` | `/api/tasks` | `TaskRequest` (validated) | `TaskService.create` → `201 Created` + `TaskResponse` |
| `PUT` | `/api/tasks/{id}` | `TaskRequest` (validated) | `TaskService.update` → `200 OK` + `TaskResponse` |
| `DELETE` | `/api/tasks/{id}` | — | `TaskService.delete` → `204 No Content` |

### `task/dto/`

| File | Purpose |
|---|---|
| `TaskRequest.java` | Record: `title` (required, ≤150), `description` (≤5000, nullable), `priority` (required enum), `status` (required enum), `dueDate` (nullable `LocalDate`). Used identically for both create (`POST`) and full update (`PUT`). |
| `TaskResponse.java` | Record mirroring `Task` minus internal details: `id`, `title`, `description`, `priority`, `status`, `dueDate`, `createdAt`, `updatedAt`. Built via static `TaskResponse.from(Task)`. Notably omits the owning `user` — the frontend never needs to know the task's owner since it can only ever see its own. |
| `PageResponse.java` | Generic pagination envelope: `content: List<T>`, `page`, `size`, `totalElements`, `totalPages`, `first`, `last`. Its static `from(Page<E>, Function<E,T> mapper)` both maps entity→DTO for every item in the page *and* copies over Spring Data's pagination metadata, decoupling the API's JSON shape from Spring's `Page` implementation. |

---

## `user/` — user entity & self-lookup

### `User.java` (JPA entity, table `users`, **also a Spring Security `UserDetails`**)
Fields: `id`, `name`, `email` (unique), `password` (BCrypt hash, no public getter — only `setPassword` is exposed; `getPassword()` exists only to satisfy `UserDetails`), `role` (`Role` enum, default `ROLE_USER`), `createdAt`.

Implements every `UserDetails` method:
- `getAuthorities()` → `[SimpleGrantedAuthority(role.name())]` — i.e. `ROLE_USER` or `ROLE_ADMIN` becomes the Spring Security authority string.
- `getUsername()` → returns **`email`**, not a separate username field — the app authenticates by email throughout.
- `isAccountNonExpired/isAccountNonLocked/isCredentialsNonExpired/isEnabled` → all hardcoded `true` (no account-lockout or expiry feature exists).

Because `User` *is* the `UserDetails` used everywhere in Spring Security (`AppUserDetailsService`, `JwtAuthenticationFilter`, `AuthService.login`), the authenticated principal injected via `@AuthenticationPrincipal User user` in controllers is the literal JPA entity — no separate "principal" or "session" class exists.

### `Role.java`
```java
enum Role { ROLE_USER, ROLE_ADMIN }
```
`ROLE_ADMIN` is defined but nothing in the codebase currently branches on it (no admin-only endpoints exist yet) — it's forward-looking/unused at present.

### `UserController.java`
`@RestController` at `/api/users`. One endpoint:
- `GET /api/users/me` → returns `UserResponse.from(user)` for the authenticated user. This is what the frontend could call to refresh "who am I" (though in practice the SPA gets the user object directly from the login/register response and caches it).

### `UserRepository.java`
```java
interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
```
Both derived-query methods back the auth flow: `existsByEmail` for duplicate-registration checks, `findByEmail` for `AppUserDetailsService`'s login lookup.

---

## `security/` — JWT machinery

### `JwtService.java`
Issues and verifies HMAC-signed JWTs.
- Constructed with `@Value("${app.jwt.secret}")` (Base64 string, turned into a `SecretKey` via `Keys.hmacShaKeyFor`) and `@Value("${app.jwt.expiration-ms}")` (token lifetime, default 24h from `application.yml`).
- **`generateToken(UserDetails userDetails)`** — builds a JWT whose `subject` is `userDetails.getUsername()` (the email), `issuedAt` = now, `expiration` = now + `expirationMs`, signed with the HMAC key.
- **`extractUsername(String token)`** — parses and returns the subject claim.
- **`isTokenValid(token, userDetails)`** — true iff the token's subject matches the given user's username AND the token isn't expired.
- **`isTokenExpired`** / **`extractClaim`** — internal helpers; `extractClaim` does the actual signature-verified parse (`Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token)`), so an invalid signature throws before any claim is read.

### `JwtAuthenticationFilter.java`
A `OncePerRequestFilter` (runs once per request, registered before `UsernamePasswordAuthenticationFilter` in `SecurityConfig`):
1. Reads the `Authorization` header; if missing or not `Bearer <token>`-shaped, passes the request through unauthenticated (no error — public endpoints still need to work).
2. Otherwise, extracts the token, pulls the username (email) via `JwtService.extractUsername`.
3. If there's an email and no existing authentication in the `SecurityContextHolder`, loads the `UserDetails` via the injected `UserDetailsService` (`AppUserDetailsService`), and if `JwtService.isTokenValid(token, userDetails)` passes, builds a `UsernamePasswordAuthenticationToken(userDetails, null, authorities)`, attaches request details, and sets it as the current `Authentication`.
4. Any exception during this process (expired/malformed/tampered token) is swallowed and the security context is cleared — the request continues unauthenticated, and downstream authorization rules (`anyRequest().authenticated()`) are what actually produce the `401`, via `JwtAuthenticationEntryPoint`.

### `JwtAuthenticationEntryPoint.java`
Implements `AuthenticationEntryPoint` — the callback Spring Security invokes whenever an unauthenticated request hits a protected endpoint (or an authentication attempt fails). Writes a `401` response with a JSON `ApiError` body (via the injected Jackson `ObjectMapper`), so unauthenticated API failures look identical in shape to every other handled error, rather than falling back to Spring's default HTML error page.

### `AppUserDetailsService.java`
Implements Spring Security's `UserDetailsService` — the single required method, `loadUserByUsername(String email)`, calls `userRepository.findByEmail(email)` and throws `UsernameNotFoundException` if absent. Used both by `JwtAuthenticationFilter` (to rehydrate the user on each request) and by `DaoAuthenticationProvider` (during the `/login` `AuthenticationManager.authenticate(...)` call).

---

## `config/SecurityConfig.java`

The single `@Configuration` class wiring the whole security setup together. Key beans:

- **`securityFilterChain(HttpSecurity http)`** — the main filter chain definition:
  - Enables CORS using `corsConfigurationSource()`.
  - Disables CSRF (safe here because the API is stateless/token-based, not cookie-session-based).
  - Authorization rules: `/api/auth/**` and `/actuator/health` are `permitAll()`; everything else requires authentication.
  - `SessionCreationPolicy.STATELESS` — Spring Security never creates or reads an `HttpSession`.
  - Registers `JwtAuthenticationEntryPoint` as the handler for authentication failures.
  - Registers the custom `AuthenticationProvider` (below).
  - Inserts `JwtAuthenticationFilter` **before** `UsernamePasswordAuthenticationFilter` in the chain.
- **`corsConfigurationSource()`** — builds allowed origins from the comma-separated `app.cors.allowed-origins` property (default `http://localhost:4200`), allows methods `GET/POST/PUT/PATCH/DELETE/OPTIONS`, all headers, exposes the `Authorization` header to JS, allows credentials, caches preflight for 1 hour.
- **`authenticationProvider()`** — a `DaoAuthenticationProvider` wired to `AppUserDetailsService` + the `BCryptPasswordEncoder` bean, used for the login flow's `AuthenticationManager.authenticate(...)`.
- **`authenticationManager(AuthenticationConfiguration config)`** — exposes Spring's built-in `AuthenticationManager` as an injectable bean (needed by `AuthService`).
- **`passwordEncoder()`** — `BCryptPasswordEncoder`, used both for hashing on register and verifying on login.

`@EnableMethodSecurity` is also set on the class, though no `@PreAuthorize`/`@Secured` annotations currently appear elsewhere in the codebase — it's enabled but not yet exercised.

---

## `exception/` — consistent error handling

### `ApiError.java`
A record describing the **one JSON shape every error response uses**: `timestamp`, `status`, `error` (short label, e.g. `"Not Found"`), `message`, `path` (the request URI), and an optional `fieldErrors: List<FieldValidationError>` (each with a `field` + `message`) — only populated for validation failures. `@JsonInclude(NON_NULL)` means `fieldErrors` is omitted from the JSON entirely (not `null`) when there isn't any. Two static factories: `of(status, error, message, path)` and an overload that also takes `fieldErrors`.

### `GlobalExceptionHandler.java`
A `@RestControllerAdvice` — a single class that centrally converts exceptions thrown *anywhere* in a controller (or its call chain) into an `ApiError` response. Maps:

| Exception | HTTP status | `error` label |
|---|---|---|
| `MethodArgumentNotValidException` (Bean Validation failure on `@Valid` body) | 400 | `Validation Failed` — includes per-field messages in `fieldErrors` |
| `MethodArgumentTypeMismatchException` (e.g. `?status=NOT_A_REAL_ENUM`) | 400 | `Bad Request` |
| `ResourceNotFoundException` (custom) | 404 | `Not Found` |
| `EmailAlreadyExistsException` (custom) | 409 | `Conflict` |
| `BadCredentialsException` (Spring Security) | 401 | `Unauthorized` — message is always the generic `"Invalid email or password"` (never reveals whether the email existed) |
| `AccessDeniedException` (Spring Security) | 403 | `Forbidden` |
| `Exception` (catch-all) | 500 | `Internal Server Error` — message is always the generic `"An unexpected error occurred"` (no internal details/stack traces leak to clients) |

### `EmailAlreadyExistsException.java` / `ResourceNotFoundException.java`
Both simple `RuntimeException` subclasses with a message constructor — thrown from `AuthService` and `TaskService` respectively, caught only by `GlobalExceptionHandler`.

---

## `resources/application.yml`

All runtime configuration, every value overridable by environment variable:

```yaml
server.port: 8080                         # $SERVER_PORT
spring.datasource.url: jdbc:postgresql://localhost:5432/task_manager   # $DB_HOST $DB_PORT $DB_NAME
spring.datasource.username/password: postgres/postgres                 # $DB_USERNAME $DB_PASSWORD
spring.jpa.hibernate.ddl-auto: update     # auto-creates/updates schema from entities
app.jwt.secret: <base64 dev default>      # $APP_JWT_SECRET — MUST be overridden in production
app.jwt.expiration-ms: 86400000           # $APP_JWT_EXPIRATION_MS — 24h default
app.cors.allowed-origins: http://localhost:4200   # $APP_CORS_ORIGINS
```

`show-sql: true` and `format_sql: true` are on for dev visibility; `open-in-view: false` disables the "Open Session in View" anti-pattern (no lazy-loading surprises in the view layer, since there is no server-rendered view layer here anyway — pure REST API).

## `pom.xml`

Maven build file. Key dependencies: `spring-boot-starter-web` (REST/MVC), `spring-boot-starter-data-jpa` (Hibernate/Spring Data), `spring-boot-starter-validation` (Bean Validation), `spring-boot-starter-security`, `postgresql` (JDBC driver, runtime scope), `jjwt-api`/`jjwt-impl`/`jjwt-jackson` (JWT library, version 0.12.6), plus test-scoped `spring-boot-starter-test` and `spring-security-test`. Java 21, Spring Boot parent 3.4.4. The `spring-boot-maven-plugin` produces the executable JAR (`target/task-manager-1.0.0.jar`).
