package com.ixlab.controller;

import com.ixlab.dto.CategoryDto;
import com.ixlab.dto.CreateCategoryRequest;
import com.ixlab.service.ConfigurationService;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.*;
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.validation.Validated;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import javax.validation.Valid;
import java.security.Principal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Controller("/api/categories")
@Validated
@Secured(SecurityRule.IS_AUTHENTICATED)
@ExecuteOn(TaskExecutors.IO)
@Tag(name = "Categories", description = "API for managing configuration categories")
@SecurityRequirement(name = "bearerAuth")
public class CategoryController {

    private final ConfigurationService configService;

    public CategoryController(ConfigurationService configService) {
        this.configService = configService;
    }

    @Get(produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "List all categories for the authenticated user")
    @ApiResponse(responseCode = "200", description = "List of categories")
    @ApiResponse(responseCode = "401", description = "Unauthorized")
    public List<CategoryDto> list(Principal principal) {
        return configService.getCategories(principal.getName());
    }

    @Post(consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a category, or return the existing one with the same name")
    @ApiResponse(responseCode = "200", description = "Category created")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public CategoryDto create(@Valid @Body CreateCategoryRequest request, Principal principal) {
        return configService.createCategory(request.getName(), principal.getName());
    }

    @Delete(value = "/{id}")
    @Operation(summary = "Delete a category and all its configurations")
    @ApiResponse(responseCode = "200", description = "Category deleted")
    @ApiResponse(responseCode = "404", description = "Category not found")
    public Map<String, Boolean> delete(@PathVariable Long id, Principal principal) {
        configService.deleteCategory(id, principal.getName());
        return Collections.singletonMap("deleted", true);
    }
}
