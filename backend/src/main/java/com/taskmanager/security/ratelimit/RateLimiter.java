package com.taskmanager.security.ratelimit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A simple in-memory fixed-window rate limiter.
 *
 * <p>Suitable for a single application instance. In a horizontally-scaled
 * deployment this should be backed by a shared store (e.g. Redis) so limits
 * are enforced across nodes.
 */
@Component
public class RateLimiter {

    private final int capacity;
    private final long windowSeconds;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimiter(@Value("${app.rate-limit.auth.capacity}") int capacity,
                       @Value("${app.rate-limit.auth.window-seconds}") long windowSeconds) {
        this.capacity = capacity;
        this.windowSeconds = windowSeconds;
    }

    public long getWindowSeconds() {
        return windowSeconds;
    }

    /** @return true if the request is allowed; false if the limit is exceeded. */
    public boolean tryAcquire(String key) {
        Window window = windows.computeIfAbsent(key, k -> new Window(Instant.now()));
        synchronized (window) {
            Instant now = Instant.now();
            if (Duration.between(window.start, now).getSeconds() >= windowSeconds) {
                window.start = now;
                window.count = 0;
            }
            if (window.count >= capacity) {
                return false;
            }
            window.count++;
            return true;
        }
    }

    private static final class Window {
        private Instant start;
        private int count;

        private Window(Instant start) {
            this.start = start;
        }
    }
}
