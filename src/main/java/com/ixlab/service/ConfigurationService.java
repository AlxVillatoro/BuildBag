package com.ixlab.service;

import com.ixlab.domain.Category;
import com.ixlab.domain.ConfigurationFile;
import com.ixlab.domain.User;
import com.ixlab.dto.CategoryDto;
import com.ixlab.dto.ConfigurationDto;
import com.ixlab.dto.SaveConfigurationRequest;
import com.ixlab.exception.ApiException;
import com.ixlab.repository.CategoryRepository;
import com.ixlab.repository.ConfigurationFileRepository;
import com.ixlab.repository.UserRepository;
import io.micronaut.transaction.annotation.ReadOnly;

import jakarta.inject.Singleton;
import javax.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Singleton
@Transactional
public class ConfigurationService {

    private final ConfigurationFileRepository configRepo;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;

    public ConfigurationService(ConfigurationFileRepository configRepo,
                                CategoryRepository categoryRepo,
                                UserRepository userRepo) {
        this.configRepo = configRepo;
        this.categoryRepo = categoryRepo;
        this.userRepo = userRepo;
    }

    @ReadOnly
    public List<CategoryDto> getCategoriesWithConfigurations(String username) {
        Map<Long, List<ConfigurationDto>> byCategory = new HashMap<>();
        for (ConfigurationDto config : configRepo.findSummariesByOwner(username)) {
            byCategory.computeIfAbsent(config.getCategoryId(), id -> new ArrayList<>()).add(config);
        }
        List<CategoryDto> categories = getCategories(username);
        for (CategoryDto category : categories) {
            category.setConfigurations(byCategory.getOrDefault(category.getId(), Collections.emptyList()));
        }
        return categories;
    }

    @ReadOnly
    public List<CategoryDto> getCategories(String username) {
        return categoryRepo.findByOwnerUsernameOrderByName(username)
            .stream()
            .map(cat -> new CategoryDto(cat.getId(), cat.getName()))
            .collect(Collectors.toList());
    }

    @ReadOnly
    public List<ConfigurationDto> getConfigurations(String username) {
        return configRepo.findSummariesByOwner(username);
    }

    @ReadOnly
    public ConfigurationDto getConfiguration(Long configId, String username) {
        ConfigurationFile config = requireConfiguration(configId, username);
        ConfigurationDto dto = ConfigurationDto.from(config);
        dto.setContentBase64(Base64.getEncoder().encodeToString(config.getContent()));
        return dto;
    }

    public CategoryDto createCategory(String name, String username) {
        Category category = findOrCreateCategory(name, username);
        return new CategoryDto(category.getId(), category.getName());
    }

    public ConfigurationDto saveConfiguration(SaveConfigurationRequest request, String username) {
        if (isBlank(request.getName()) || request.getJson() == null) {
            throw ApiException.badRequest("El nombre y el contenido de la configuración son obligatorios");
        }
        Category category = resolveCategory(request, username);
        if (category == null) {
            throw ApiException.badRequest("Selecciona o crea una categoría");
        }

        ConfigurationFile config = new ConfigurationFile();
        config.setName(request.getName().trim());
        config.setSubcategory(request.getSubcategory());
        config.setContent(request.getJson().getBytes(StandardCharsets.UTF_8));
        config.setOwner(requireUser(username));
        config.setCategory(category);

        return ConfigurationDto.from(configRepo.save(config));
    }

    public ConfigurationDto updateConfiguration(Long configId, SaveConfigurationRequest request, String username) {
        ConfigurationFile config = requireConfiguration(configId, username);

        if (!isBlank(request.getName())) {
            config.setName(request.getName().trim());
        }
        if (request.getSubcategory() != null) {
            config.setSubcategory(request.getSubcategory());
        }
        if (request.getJson() != null) {
            config.setContent(request.getJson().getBytes(StandardCharsets.UTF_8));
        }
        Category category = resolveCategory(request, username);
        if (category != null) {
            config.setCategory(category);
        }

        return ConfigurationDto.from(configRepo.update(config));
    }

    public void deleteConfiguration(Long configId, String username) {
        configRepo.delete(requireConfiguration(configId, username));
    }

    public void deleteCategory(Long categoryId, String username) {
        categoryRepo.delete(requireCategory(categoryId, username));
    }

    /** The category named by the request, or null if it names none. Only ever resolves to the user's own categories. */
    private Category resolveCategory(SaveConfigurationRequest request, String username) {
        if (request.getCategoryId() != null) {
            return requireCategory(request.getCategoryId(), username);
        }
        return isBlank(request.getCategoryName()) ? null : findOrCreateCategory(request.getCategoryName(), username);
    }

    private Category findOrCreateCategory(String name, String username) {
        String trimmed = name.trim();
        return categoryRepo.findByNameAndOwnerUsername(trimmed, username)
            .orElseGet(() -> categoryRepo.save(new Category(trimmed, requireUser(username))));
    }

    private Category requireCategory(Long categoryId, String username) {
        return categoryRepo.findByIdAndOwnerUsername(categoryId, username)
            .orElseThrow(() -> ApiException.notFound("Categoría no encontrada"));
    }

    private ConfigurationFile requireConfiguration(Long configId, String username) {
        return configRepo.findByIdAndOwnerUsername(configId, username)
            .orElseThrow(() -> ApiException.notFound("Configuración no encontrada"));
    }

    private User requireUser(String username) {
        return userRepo.findByUsername(username)
            .orElseThrow(() -> ApiException.unauthorized("Usuario no encontrado"));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
