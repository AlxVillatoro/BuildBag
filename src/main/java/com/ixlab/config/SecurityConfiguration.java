package com.ixlab.config;

import io.micronaut.context.annotation.Factory;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.security.rules.SecurityRuleResult;
import jakarta.inject.Singleton;
import reactor.core.publisher.Mono;

@Factory
public class SecurityConfiguration {

    @Singleton
    SecurityRule customSecurityRule() {
        return (request, routeMatch, claims) -> {
            String path = request.getPath();
            
            // Allow anonymous access to root path
            if (path.equals("/") || path.equals("")) {
                return Mono.just(SecurityRuleResult.ALLOWED);
            }
            
            // Allow anonymous access to login, register and panel pages
            // Panel verifies auth via JavaScript with JWT token
            if (path.equals("/login") || path.equals("/register") || path.equals("/panel")) {
                return Mono.just(SecurityRuleResult.ALLOWED);
            }
            
            // Allow anonymous access to static folder
            if (path.startsWith("/static/")) {
                return Mono.just(SecurityRuleResult.ALLOWED);
            }
            
            // Allow anonymous access to auth API endpoints
            if (path.startsWith("/api/auth/")) {
                return Mono.just(SecurityRuleResult.ALLOWED);
            }
            
            // Allow anonymous access to static resources
            if (path.startsWith("/css/") || path.startsWith("/js/") || 
                path.startsWith("/images/") || path.startsWith("/assets/") ||
                path.endsWith(".css") || path.endsWith(".js") || 
                path.endsWith(".png") || path.endsWith(".jpg") ||
                path.endsWith(".ico") || path.endsWith(".svg") ||
                path.endsWith(".woff") || path.endsWith(".woff2") ||
                path.endsWith(".ttf")) {
                return Mono.just(SecurityRuleResult.ALLOWED);
            }
            
            // Allow anonymous access to swagger/openapi endpoints
            if (path.startsWith("/swagger") || path.startsWith("/rapidoc") || 
                path.startsWith("/redoc") || path.startsWith("/openapi")) {
                return Mono.just(SecurityRuleResult.ALLOWED);
            }
            
            // All other endpoints require authentication
            if (claims == null) {
                return Mono.just(SecurityRuleResult.REJECTED);
            }
            
            return Mono.just(SecurityRuleResult.ALLOWED);
        };
    }
}
