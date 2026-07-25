# Authentication Flow, Step by Step

The app uses **stateless JWT authentication**: no server-side sessions, no cookies for auth — every request carries its own bearer token, verified fresh each time.

## 1. Registration

```
RegisterComponent (form submit)
  → AuthService.register(payload)                                    [frontend]
    → HTTP POST /api/auth/register  { name, email, password }
      → authInterceptor attaches Authorization header (none exists yet — no-op)
      → network →
      → JwtAuthenticationFilter: no valid Bearer token → continues unauthenticated
      → SecurityConfig: "/api/auth/**" is permitAll() → request proceeds regardless
      → AuthController.register(RegisterRequest)                     [backend]
        → @Valid triggers Bean Validation on RegisterRequest
           (name 2-100 chars, valid email ≤150 chars, password 6-100 chars)
           — on failure: MethodArgumentNotValidException → 400 + fieldErrors[]
        → AuthService.register(request)
          → userRepository.existsByEmail(email)?
             — if true: throw EmailAlreadyExistsException → 409 Conflict
          → passwordEncoder.encode(password)   [BCrypt hash]
          → User.builder()...role(ROLE_USER).build()
          → userRepository.save(user)           [INSERT INTO users ...]
          → jwtService.generateToken(user)      [signs a JWT, subject = email]
          → AuthResponse.of(token, user)        [wraps token + UserResponse]
      ← 201 Created  { token, tokenType: "Bearer", user: {...} }
    ← AuthService.storeSession(res)             [frontend]
       — localStorage.setItem('taskflow.token', token)
       — localStorage.setItem('taskflow.user', JSON.stringify(user))
       — _user.set(user)   [signal update → isAuthenticated() flips to true]
  → router.navigate(['/dashboard'])
```

## 2. Login

Identical shape to registration, except:
- `AuthController.login` → `AuthService.login(request)`.
- Instead of creating a user, `AuthService.login` calls Spring Security's `AuthenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password))`.
- Internally, this invokes `DaoAuthenticationProvider`, which:
  1. Calls `AppUserDetailsService.loadUserByUsername(email)` → `userRepository.findByEmail(email)` (throws `UsernameNotFoundException` if absent).
  2. Uses the `PasswordEncoder` (BCrypt) to compare the submitted password against the stored hash.
  3. On any failure (user not found *or* wrong password), Spring throws `BadCredentialsException` — deliberately the **same** exception/message either way (`"Invalid email or password"`), so the API never reveals whether an email is registered.
- On success, `authentication.getPrincipal()` **is** the `User` entity (since `User implements UserDetails`), cast directly — no separate DB lookup is needed after `authenticate()` succeeds.
- A fresh JWT is generated and returned exactly like registration.

## 3. Making an authenticated request (e.g. loading the task list)

```
DashboardComponent.load()
  → TaskService.list(query)
    → HttpClient.get('/api/tasks', { params })
      → authInterceptor: token = AuthService.getToken()  [reads localStorage]
         — req.clone({ setHeaders: { Authorization: `Bearer <token>` } })
      → network →
      → JwtAuthenticationFilter.doFilterInternal            [backend, runs first]
        → reads "Authorization" header, strips "Bearer " prefix
        → email = jwtService.extractUsername(token)          [parses + verifies signature]
        → userDetails = userDetailsService.loadUserByUsername(email)
        → jwtService.isTokenValid(token, userDetails)?
           — subject matches AND not expired
        → SecurityContextHolder.getContext().setAuthentication(
             new UsernamePasswordAuthenticationToken(userDetails, null, authorities))
      → SecurityConfig authorization check: anyRequest().authenticated() → passes
        (an authenticated principal now exists in the SecurityContext)
      → TaskController.list(@AuthenticationPrincipal User user, ...)
         — Spring Security resolves @AuthenticationPrincipal from
           SecurityContextHolder's Authentication.getPrincipal() → the User entity
        → TaskService.search(user, ...)                       [scoped to user.getId()]
      ← 200 OK  { content: [...], page, size, totalElements, ... }
    ← errorInterceptor: no error, passes response through untouched
  ← tasks.set(result.content) [signal update → template re-renders]
```

## 4. What happens on an invalid/expired token

```
JwtAuthenticationFilter catches any exception from jwtService.extractUsername/isTokenValid
  → SecurityContextHolder.clearContext()   [request continues, but unauthenticated]
→ SecurityConfig: anyRequest().authenticated() fails (no Authentication present)
→ JwtAuthenticationEntryPoint.commence(...)
  → writes 401 + ApiError{ status:401, error:"Unauthorized",
      message:"Authentication is required to access this resource" }
← (frontend) errorInterceptor catches HttpErrorResponse{status:401}
  → request URL doesn't contain "/auth/" → auth.logout()
     — clears localStorage, resets _user signal to null, navigates to /login
  → re-throws a normalized Error so the calling component's .subscribe({error}) still fires
```

This is the mechanism that makes an expired 24-hour token (or a token invalidated by, say, clearing browser storage on another device) transparently force a re-login on the user's very next API call — there's no token refresh mechanism; the user simply has to log in again.

## 5. Logout

Purely a frontend/local operation — there is no server-side "invalidate this token" endpoint (JWTs here are stateless and can't be revoked early; they simply expire after `APP_JWT_EXPIRATION_MS`, default 24h). `AuthService.logout()`:
1. Removes both `localStorage` keys.
2. Sets the `_user` signal to `null` (→ `isAuthenticated()` becomes `false` → `App`'s `showNavbar` hides the navbar → `authGuard` will now block `/dashboard` and redirect to `/login`).
3. Navigates to `/login`.

## 6. Route-level protection (guards) vs. request-level protection (interceptor + backend filter)

These are two independent, complementary layers:
- **`authGuard`/`guestGuard`** only control which **page/route** Angular renders — a purely client-side UX guard. They read the *cached* `isAuthenticated()` state; they never call the backend to verify the token is still valid.
- **`JwtAuthenticationFilter`** on the backend is the actual security boundary — it verifies the token's signature and expiry on every single request, regardless of what the frontend thinks the auth state is. A stale/tampered token gets rejected here even if the Angular guard let the user onto `/dashboard`.

In short: guards make for a good user experience (don't show a page you can't use); the JWT filter is what actually protects the data.
