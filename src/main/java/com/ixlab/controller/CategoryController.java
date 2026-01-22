package com.ixlab.controller;

import com.ixlab.domain.Category;
import com.ixlab.domain.User;
import com.ixlab.dto.CategoryDto;
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
import java.util.Map;
import java.util.Optional;

@Controller("/api/categories")
@Tag(name = "Categories", description = "API for managing configuration categories")
@SecurityRequirement(name = "bearerAuth")
public class CategoryController {

    private final ConfigurationService configService;
    private final UserRepository userRepo;
    private final SecurityService securityService;

    public CategoryController(ConfigurationService configService, 
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
    @Operation(summary = "List all categories for the authenticated user")
    @ApiResponse(responseCode = "200", description = "List of categories")
    @ApiResponse(responseCode = "401", description = "Unauthorized")
    public HttpResponse<List<CategoryDto>> list() {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        return HttpResponse.ok(configService.getCategories(ou.get().getId()));
    }

    @Post(consumes = MediaType.APPLICATION_JSON, produces = MediaType.APPLICATION_JSON)
    @Operation(summary = "Create a new category")
    @ApiResponse(responseCode = "200", description = "Category created")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    public HttpResponse<CategoryDto> create(@Body Map<String, String> body) {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        
        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return HttpResponse.badRequest();
        }
        
        Category cat = configService.createCategory(name, ou.get().getId());
        return HttpResponse.ok(new CategoryDto(cat.getId(), cat.getName()));
    }

    @Delete(value = "/{id}")
    @Operation(summary = "Delete a category and all its configurations")
    @ApiResponse(responseCode = "200", description = "Category deleted")
    @ApiResponse(responseCode = "404", description = "Category not found")
    public HttpResponse<?> delete(@PathVariable Long id) {
        Optional<User> ou = userFromSecurity();
        if (!ou.isPresent()) return HttpResponse.unauthorized();
        
        try {
            configService.deleteCategory(id, ou.get().getId());
            return HttpResponse.ok(Collections.singletonMap("deleted", true));
        } catch (RuntimeException e) {
            return HttpResponse.notFound();
        }
    }
}

