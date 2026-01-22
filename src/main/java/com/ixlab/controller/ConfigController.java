package com.ixlab.controller;

import com.ixlab.domain.User;
import com.ixlab.dto.CategoryDto;
import com.ixlab.dto.ConfigurationDto;
import com.ixlab.dto.SaveConfigurationRequest;
import com.ixlab.repository.UserRepository;
import com.ixlab.service.ConfigurationService;
import io.micronaut.security.utils.SecurityService;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Controller("/api/configs")
@Tag(name = "Configurations", description = "API for managing configuration files")
@SecurityRequirement(name = "bearerAuth")
public class ConfigController {

    private final ConfigurationService configService;
    private final UserRepository userRepo;
    private final SecurityService securityService;

    public ConfigController(ConfigurationService configService, 
                           UserRepository userRepo, 
                           SecurityService securityService) {
        this.configService = configService;
        this.userRepo = userRepo;
        this.securityService = securityService;
    }

    private Optional<User> userFromSecurity() {
        return securityService.getAuthentication().flatMap(auth -> userRepo.findByUsername(auth.getName()));
    }

    @Get(produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "List all configurations for the authenticated user")
    @ApiResponse(responseCode = "200", description = "List of configurations")
    @ApiResponse(responseCode = "401", description = "Unauthorized")
    public HttpResponse<List<ConfigurationDto>> list() {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        return HttpResponse.ok(configService.getConfigurations(ou.get().getId()));
    }

    @Get(value = "/{id}", produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Get a specific configuration by ID")
    @ApiResponse(responseCode = "200", description = "Configuration found")
    @ApiResponse(responseCode = "404", description = "Configuration not found")
    public HttpResponse<ConfigurationDto> get(@PathVariable Long id) {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        
        Optional<ConfigurationDto> config = configService.getConfiguration(id, ou.get().getId());
        if (!config.isPresent()) return HttpResponse.notFound();
        
        return HttpResponse.ok(config.get());
    }

    @Get(value = "/with-categories", produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "List all categories with their configurations")
    @ApiResponse(responseCode = "200", description = "List of categories with configurations")
    public HttpResponse<List<CategoryDto>> listWithCategories() {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        return HttpResponse.ok(configService.getCategoriesWithConfigurations(ou.get().getId()));
    }

    @Post(consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a new configuration")
    @ApiResponse(responseCode = "200", description = "Configuration created")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public HttpResponse<ConfigurationDto> create(@Body SaveConfigurationRequest request) {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        
        if (request.getName() == null || request.getJson() == null) {
            return HttpResponse.badRequest();
        }
        
        try {
            ConfigurationDto dto = configService.saveConfiguration(request, ou.get().getId());
            return HttpResponse.ok(dto);
        } catch (Exception e) {
            return HttpResponse.badRequest();
        }
    }

    @Put(value = "/{id}", consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Update an existing configuration")
    @ApiResponse(responseCode = "200", description = "Configuration updated")
    @ApiResponse(responseCode = "404", description = "Configuration not found")
    public HttpResponse<ConfigurationDto> update(@PathVariable Long id, @Body SaveConfigurationRequest request) {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        
        try {
            ConfigurationDto dto = configService.updateConfiguration(id, request, ou.get().getId());
            return HttpResponse.ok(dto);
        } catch (RuntimeException e) {
            return HttpResponse.notFound();
        }
    }

    @Delete(value = "/{id}")
    @Operation(summary = "Delete a configuration")
    @ApiResponse(responseCode = "200", description = "Configuration deleted")
    @ApiResponse(responseCode = "404", description = "Configuration not found")
    public HttpResponse<?> delete(@PathVariable Long id) {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        
        try {
            configService.deleteConfiguration(id, ou.get().getId());
            return HttpResponse.ok(Collections.singletonMap("deleted", true));
        } catch (RuntimeException e) {
            return HttpResponse.notFound();
        }
    }
}
