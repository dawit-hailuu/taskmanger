package com.taskmanager.auth.support;

import jakarta.servlet.http.HttpServletRequest;

/** Caller network context, extracted at the web layer and passed into services. */
public record ClientInfo(String ipAddress, String userAgent) {

    public static ClientInfo from(HttpServletRequest request) {
        return new ClientInfo(clientIp(request), request.getHeader("User-Agent"));
    }

    /** Honours the first hop in X-Forwarded-For when behind a proxy/load balancer. */
    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
