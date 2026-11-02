package com.ixlab.controller;

import com.ixlab.dto.CategoryDto;
import com.ixlab.dto.ConfigurationDto;
import com.ixlab.dto.SaveConfigurationRequest;
import com.ixlab.service.ConfigurationService;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.*;
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.security.Principal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Controller("/api/configs")
@Secured(SecurityRule.IS_AUTHENTICATED)
@ExecuteOn(TaskExecutors.IO)
@Tag(name = "Configurations", description = "API for managing configuration files")
@SecurityRequirement(name = "bearerAuth")
public class ConfigController {

    private final ConfigurationService configService;

    public ConfigController(ConfigurationService configService) {
        this.configService = configService;
    }

    @Get(produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "List all configurations for the authenticated user")
    @ApiResponse(responseCode = "200", description = "List of configurations")
    @ApiResponse(responseCode = "401", description = "Unauthorized")
    public List<ConfigurationDto> list(Principal principal) {
        return configService.getConfigurations(principal.getName());
    }

    @Get(value = "/{id}", produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Get a specific configuration by ID")
    @ApiResponse(responseCode = "200", description = "Configuration found")
    @ApiResponse(responseCode = "404", description = "Configuration not found")
    public ConfigurationDto get(@PathVariable Long id, Principal principal) {
        return configService.getConfiguration(id, principal.getName());
    }

    @Get(value = "/with-categories", produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "List all categories with their configurations")
    @ApiResponse(responseCode = "200", description = "List of categories with configurations")
    public List<CategoryDto> listWithCategories(Principal principal) {
        return configService.getCategoriesWithConfigurations(principal.getName());
    }

    @Post(consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a new configuration")
    @ApiResponse(responseCode = "200", description = "Configuration created")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public ConfigurationDto create(@Body SaveConfigurationRequest request, Principal principal) {
        return configService.saveConfiguration(request, principal.getName());
    }

    @Put(value = "/{id}", consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Update an existing configuration")
    @ApiResponse(responseCode = "200", description = "Configuration updated")
    @ApiResponse(responseCode = "404", description = "Configuration not found")
    public ConfigurationDto update(@PathVariable Long id, @Body SaveConfigurationRequest request, Principal principal) {
        return configService.updateConfiguration(id, request, principal.getName());
    }

    @Delete(value = "/{id}")
    @Operation(summary = "Delete a configuration")
    @ApiResponse(responseCode = "200", description = "Configuration deleted")
    @ApiResponse(responseCode = "404", description = "Configuration not found")
    public Map<String, Boolean> delete(@PathVariable Long id, Principal principal) {
        configService.deleteConfiguration(id, principal.getName());
        return Collections.singletonMap("deleted", true);
    }
}
