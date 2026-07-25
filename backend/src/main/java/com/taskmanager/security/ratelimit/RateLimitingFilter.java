package com.taskmanager.security.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskmanager.exception.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Throttles the most abuse-prone auth endpoints per client IP. Non-matching
 * requests pass straight through. On exceeding the limit it short-circuits
 * with a 429 and the standard {@link ApiError} body.
 *
 * <p>Deliberately not a {@code @Component}: it is wired into the Spring
 * Security filter chain explicitly by {@code SecurityConfig}. Registering it
 * as a bean would also add it to the main servlet chain, running it twice.
 */
public class RateLimitingFilter extends OncePerRequestFilter {

    /** Endpoints where brute-force / spam protection matters most. */
    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/resend-verification",
            "/api/auth/refresh"
    );

    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    public RateLimitingFilter(RateLimiter rateLimiter, ObjectMapper objectMapper) {
        this.rateLimiter = rateLimiter;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        if (!isLimited(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = clientIp(request) + ":" + request.getRequestURI();
        if (rateLimiter.tryAcquire(key)) {
            filterChain.doFilter(request, response);
            return;
        }

        writeTooManyRequests(request, response);
    }

    private boolean isLimited(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && LIMITED_PATHS.contains(request.getRequestURI());
    }

    private void writeTooManyRequests(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", String.valueOf(rateLimiter.getWindowSeconds()));

        ApiError body = ApiError.of(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "Too Many Requests",
                "Too many attempts. Please wait a moment and try again.",
                "RATE_LIMITED",
                request.getRequestURI());
        objectMapper.writeValue(response.getWriter(), body);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
