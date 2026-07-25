# API Reference

Base path: `/api`. Server default: `http://localhost:8080`. All `/tasks` and `/users` routes require header `Authorization: Bearer <token>`; `/auth/**` and `/actuator/health` are public.

Every error response (any non-2xx) uses the same JSON shape:
```json
{
  "timestamp": "2026-07-15T10:30:00Z",
  "status": 400,
  "error": "Validation Failed",
  "message": "One or more fields are invalid",
  "path": "/api/auth/register",
  "fieldErrors": [
    { "field": "password", "message": "Password must be between 6 and 100 characters" }
  ]
}
```
`fieldErrors` is omitted entirely (not present as `null`) except on validation failures.

---

## `POST /api/auth/register`
Create an account. Returns a JWT immediately — no separate login step needed after registering.

**Body** (`RegisterRequest`):
```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "hunter22" }
```
Validation: `name` 2–100 chars; `email` valid format, ≤150 chars; `password` 6–100 chars.

**Success — `201 Created`** (`AuthResponse`):
```json
{
  "token": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "user": { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "role": "ROLE_USER" }
}
```

**Errors:** `400` (validation), `409 Conflict` (email already registered).

---

## `POST /api/auth/login`
Sign in with existing credentials.

**Body** (`LoginRequest`):
```json
{ "email": "ada@example.com", "password": "hunter22" }
```

**Success — `200 OK`:** same `AuthResponse` shape as register.

**Errors:** `400` (validation — blank fields), `401 Unauthorized` (wrong email or password — message is always the generic `"Invalid email or password"`, regardless of which was wrong).

---

## `GET /api/users/me`
Returns the authenticated user's profile.

**Success — `200 OK`** (`UserResponse`):
```json
{ "id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "role": "ROLE_USER" }
```

**Errors:** `401` if the token is missing/invalid/expired.

---

## `GET /api/tasks`
List the current user's tasks — search, filter, sort, and paginate.

**Query parameters** (all optional except pagination has defaults):

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive substring match against `title` OR `description` |
| `status` | `TODO \| IN_PROGRESS \| DONE` | — | Exact match; invalid value → `400` |
| `priority` | `LOW \| MEDIUM \| HIGH` | — | Exact match; invalid value → `400` |
| `page` | int | `0` | 0-indexed; negative values clamp to `0` |
| `size` | int | `10` | Clamped to `[1, 100]` server-side |
| `sortBy` | string | `createdAt` | Must be one of `createdAt, updatedAt, dueDate, priority, status, title`; anything else silently falls back to `createdAt` |
| `direction` | `asc \| desc` | `desc` | Case-insensitive; anything other than `asc` is treated as `desc` |

**Example:** `GET /api/tasks?search=report&status=TODO&priority=HIGH&sortBy=dueDate&direction=asc&page=0&size=10`

**Success — `200 OK`** (`PageResponse<TaskResponse>`):
```json
{
  "content": [
    {
      "id": 42,
      "title": "Write project README",
      "description": "Cover setup + API",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "dueDate": "2026-07-20",
      "createdAt": "2026-07-10T09:00:00Z",
      "updatedAt": "2026-07-12T14:30:00Z"
    }
  ],
  "page": 0,
  "size": 10,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

---

## `GET /api/tasks/{id}`
Fetch a single task **owned by the current user**.

**Success — `200 OK`:** a `TaskResponse` (see shape above, minus the envelope).

**Errors:** `404 Not Found` if the task doesn't exist *or* belongs to another user — the API deliberately doesn't distinguish these two cases (message: `"Task not found with id {id}"`).

---

## `POST /api/tasks`
Create a new task, owned by the current user.

**Body** (`TaskRequest`):
```json
{
  "title": "Write project README",
  "description": "Cover setup + API",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "dueDate": "2026-07-20"
}
```
Validation: `title` required, ≤150 chars; `description` optional, ≤5000 chars; `priority` required (one of the enum values); `status` required (one of the enum values); `dueDate` optional (ISO `YYYY-MM-DD`, or `null`).

**Success — `201 Created`:** the created `TaskResponse`, including server-assigned `id`, `createdAt`, `updatedAt`.

**Errors:** `400` (validation), `401` (unauthenticated).

---

## `PUT /api/tasks/{id}`
Full update/replace of a task owned by the current user. Same body shape and validation as `POST`.

**Success — `200 OK`:** the updated `TaskResponse` (with a refreshed `updatedAt`).

**Errors:** `400` (validation), `404` (not found / not owned).

---

## `DELETE /api/tasks/{id}`
Delete a task owned by the current user.

**Success — `204 No Content`:** empty body.

**Errors:** `404` (not found / not owned).

---

## Status code summary

| Code | Meaning here |
|---|---|
| `200` | Successful GET/PUT/login |
| `201` | Successful POST (register, login... no — register returns 201; create task returns 201) |
| `204` | Successful DELETE |
| `400` | Bean Validation failure or bad query param type |
| `401` | Missing/invalid/expired JWT, or wrong login credentials |
| `403` | Authenticated but not authorized (defined in `GlobalExceptionHandler`; no endpoint currently triggers this — no role-based restrictions are implemented yet) |
| `404` | Task not found / not owned by the caller |
| `409` | Email already registered |
| `500` | Unexpected server error (generic message only, no stack trace leaked) |
