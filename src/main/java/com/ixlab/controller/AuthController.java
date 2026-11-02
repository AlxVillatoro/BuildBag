package com.ixlab.controller;

import com.ixlab.domain.User;
import com.ixlab.dto.AuthResponse;
import com.ixlab.dto.LoginRequest;
import com.ixlab.dto.RegisterRequest;
import com.ixlab.exception.ApiException;
import com.ixlab.service.UserService;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.*;
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.security.token.jwt.generator.JwtTokenGenerator;
import io.micronaut.validation.Validated;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import javax.validation.Valid;
import java.security.Principal;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Controller("/api/auth")
@Validated
@ExecuteOn(TaskExecutors.IO)
@Tag(name = "Authentication", description = "API for user authentication and registration")
public class AuthController {

    private final UserService userService;
    private final JwtTokenGenerator tokenGenerator;

    public AuthController(UserService userService, JwtTokenGenerator tokenGenerator) {
        this.userService = userService;
        this.tokenGenerator = tokenGenerator;
    }

    @Post(value = "/register", consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Secured(SecurityRule.IS_ANONYMOUS)
    @Operation(summary = "Register a new user")
    @ApiResponse(responseCode = "200", description = "User registered successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    @ApiResponse(responseCode = "409", description = "Username already exists")
    public AuthResponse register(@Valid @Body RegisterRequest request) {
        User user = userService.register(request.getUsername(), request.getPassword());
        return issueToken(user.getUsername());
    }

    @Post(value = "/login", consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Secured(SecurityRule.IS_ANONYMOUS)
    @Operation(summary = "Login and get JWT token")
    @ApiResponse(responseCode = "200", description = "Login successful")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    public AuthResponse login(@Valid @Body LoginRequest request) {
        User user = userService.authenticate(request.getUsername(), request.getPassword())
            .orElseThrow(() -> ApiException.unauthorized("Usuario o contraseña incorrectos"));
        return issueToken(user.getUsername());
    }

    @Get(value = "/validate", produces = MediaType.APPLICATION_JSON)
    @Secured(SecurityRule.IS_AUTHENTICATED)
    @Operation(summary = "Validate JWT token and get user info")
    @ApiResponse(responseCode = "200", description = "Token is valid")
    @ApiResponse(responseCode = "401", description = "Token is invalid or expired")
    public Map<String, Object> validate(Principal principal) {
        Map<String, Object> response = new HashMap<>();
        response.put("valid", true);
        response.put("username", principal.getName());
        return response;
    }

    private AuthResponse issueToken(String username) {
        return tokenGenerator.generateToken(Collections.singletonMap("sub", username))
            .map(token -> new AuthResponse(token, username))
            .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo generar el token"));
    }
}
