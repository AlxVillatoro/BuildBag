package com.ixlab.controller;

import com.ixlab.domain.User;
import com.ixlab.dto.AuthResponse;
import com.ixlab.dto.LoginRequest;
import com.ixlab.dto.RegisterRequest;
import com.ixlab.service.UserService;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.*;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.security.token.jwt.generator.JwtTokenGenerator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Controller("/api/auth")
@Tag(name = "Authentication", description = "API for user authentication and registration")
public class AuthController {

    private final UserService userService;
    private final JwtTokenGenerator tokenGenerator;

    public AuthController(UserService userService, JwtTokenGenerator tokenGenerator) {
        this.userService = userService;
        this.tokenGenerator = tokenGenerator;
    }

    private Map<String, String> errorMap(String message) {
        return Collections.singletonMap("error", message);
    }

    @Post(value = "/register", consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Secured(SecurityRule.IS_ANONYMOUS)
    @Operation(summary = "Register a new user")
    @ApiResponse(responseCode = "200", description = "User registered successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request or username already exists")
    public HttpResponse<?> register(@Body RegisterRequest request) {
        if (request.getUsername() == null || request.getPassword() == null) {
            return HttpResponse.badRequest(errorMap("Username and password are required"));
        }
        
        if (request.getUsername().length() < 3) {
            return HttpResponse.badRequest(errorMap("Username must be at least 3 characters"));
        }
        
        if (request.getPassword().length() < 6) {
            return HttpResponse.badRequest(errorMap("Password must be at least 6 characters"));
        }
        
        try {
            User u = userService.register(request.getUsername(), request.getPassword());
            
            Map<String, Object> claims = new HashMap<>();
            claims.put("username", u.getUsername());
            claims.put("sub", u.getUsername());
            
            Optional<String> token = tokenGenerator.generateToken(claims);
            
            if (token.isPresent()) {
                AuthResponse response = new AuthResponse(token.get(), u.getUsername());
                return HttpResponse.ok(response);
            }
            
            Map<String, String> successMap = new HashMap<>();
            successMap.put("username", u.getUsername());
            successMap.put("message", "User registered successfully");
            return HttpResponse.ok(successMap);
        } catch (Exception e) {
            return HttpResponse.badRequest(errorMap("Username already exists"));
        }
    }

    @Post(value = "/login", consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Secured(SecurityRule.IS_ANONYMOUS)
    @Operation(summary = "Login and get JWT token")
    @ApiResponse(responseCode = "200", description = "Login successful")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    public HttpResponse<?> login(@Body LoginRequest request) {
        if (request.getUsername() == null || request.getPassword() == null) {
            return HttpResponse.badRequest(errorMap("Username and password are required"));
        }
        
        Optional<User> user = userService.authenticate(request.getUsername(), request.getPassword());
        if (!user.isPresent()) {
            return HttpResponse.unauthorized();
        }
        
        Map<String, Object> claims = new HashMap<>();
        claims.put("username", request.getUsername());
        claims.put("sub", request.getUsername());
        
        Optional<String> token = tokenGenerator.generateToken(claims);
        
        if (token.isPresent()) {
            AuthResponse response = new AuthResponse(token.get(), request.getUsername());
            return HttpResponse.ok(response);
        }
        
        return HttpResponse.serverError(errorMap("Failed to generate token"));
    }

    @Get(value = "/validate", produces = MediaType.APPLICATION_JSON)
    @Secured(SecurityRule.IS_AUTHENTICATED)
    @Operation(summary = "Validate JWT token and get user info")
    @ApiResponse(responseCode = "200", description = "Token is valid")
    @ApiResponse(responseCode = "401", description = "Token is invalid or expired")
    public HttpResponse<?> validate(java.security.Principal principal) {
        if (principal == null) {
            return HttpResponse.unauthorized();
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("valid", true);
        response.put("username", principal.getName());
        return HttpResponse.ok(response);
    }
}
