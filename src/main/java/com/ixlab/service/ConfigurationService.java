package com.ixlab.service;

import com.ixlab.domain.Category;
import com.ixlab.domain.ConfigurationFile;
import com.ixlab.domain.User;
import com.ixlab.dto.CategoryDto;
import com.ixlab.dto.ConfigurationDto;
import com.ixlab.dto.SaveConfigurationRequest;
import com.ixlab.repository.CategoryRepository;
import com.ixlab.repository.ConfigurationFileRepository;
import com.ixlab.repository.UserRepository;

import jakarta.inject.Singleton;
import javax.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Singleton
@Transactional
public class ConfigurationService {

    private final ConfigurationFileRepository configRepo;
    private final CategoryRepository categoryRepo;
    private final UserRepository userRepo;
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public ConfigurationService(ConfigurationFileRepository configRepo, 
                                CategoryRepository categoryRepo,
                                UserRepository userRepo) {
        this.configRepo = configRepo;
        this.categoryRepo = categoryRepo;
        this.userRepo = userRepo;
    }

    public List<CategoryDto> getCategoriesWithConfigurations(Long userId) {
        List<Category> categories = categoryRepo.findByOwnerId(userId);
        return categories.stream().map(cat -> {
            CategoryDto dto = new CategoryDto(cat.getId(), cat.getName());
            List<ConfigurationDto> configs = configRepo.findByCategoryId(cat.getId())
                .stream()
                .map(this::toConfigurationDto)
                .collect(Collectors.toList());
            dto.setConfigurations(configs);
            return dto;
        }).collect(Collectors.toList());
    }

    public List<CategoryDto> getCategories(Long userId) {
        return categoryRepo.findByOwnerId(userId)
            .stream()
            .map(cat -> new CategoryDto(cat.getId(), cat.getName()))
            .collect(Collectors.toList());
    }

    public List<ConfigurationDto> getConfigurations(Long userId) {
        return configRepo.findByOwnerId(userId)
            .stream()
            .map(this::toConfigurationDto)
            .collect(Collectors.toList());
    }

    public Optional<ConfigurationDto> getConfiguration(Long configId, Long userId) {
        return configRepo.findByIdAndOwnerId(configId, userId)
            .map(this::toConfigurationDtoWithContent);
    }

    public Category createCategory(String name, Long userId) {
        User user = userRepo.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        Category category = new Category(name, user);
        return categoryRepo.save(category);
    }

    public ConfigurationDto saveConfiguration(SaveConfigurationRequest request, Long userId) {
        User user = userRepo.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        
        Category category;
        if (request.getCategoryId() != null) {
            category = categoryRepo.findById(request.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Category not found"));
        } else if (request.getCategoryName() != null && !request.getCategoryName().trim().isEmpty()) {
            category = categoryRepo.findByNameAndOwnerId(request.getCategoryName(), userId)
                .orElseGet(() -> {
                    Category newCat = new Category(request.getCategoryName(), user);
                    return categoryRepo.save(newCat);
                });
        } else {
            throw new RuntimeException("Category ID or name is required");
        }
        
        ConfigurationFile config = new ConfigurationFile();
        config.setName(request.getName());
        config.setSubcategory(request.getSubcategory());
        config.setContent(request.getJson().getBytes(StandardCharsets.UTF_8));
        config.setOwner(user);
        config.setCategory(category);
        
        configRepo.save(config);
        
        return toConfigurationDto(config);
    }

    public ConfigurationDto updateConfiguration(Long configId, SaveConfigurationRequest request, Long userId) {
        ConfigurationFile config = configRepo.findByIdAndOwnerId(configId, userId)
            .orElseThrow(() -> new RuntimeException("Configuration not found"));
        
        if (request.getName() != null) {
            config.setName(request.getName());
        }
        if (request.getSubcategory() != null) {
            config.setSubcategory(request.getSubcategory());
        }
        if (request.getJson() != null) {
            config.setContent(request.getJson().getBytes(StandardCharsets.UTF_8));
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepo.findById(request.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Category not found"));
            config.setCategory(category);
        }
        
        configRepo.update(config);
        
        return toConfigurationDto(config);
    }

    public void deleteConfiguration(Long configId, Long userId) {
        ConfigurationFile config = configRepo.findByIdAndOwnerId(configId, userId)
            .orElseThrow(() -> new RuntimeException("Configuration not found"));
        configRepo.delete(config);
    }

    public void deleteCategory(Long categoryId, Long userId) {
        Category category = categoryRepo.findById(categoryId)
            .filter(c -> c.getOwner().getId().equals(userId))
            .orElseThrow(() -> new RuntimeException("Category not found"));
        categoryRepo.delete(category);
    }

    private ConfigurationDto toConfigurationDto(ConfigurationFile cf) {
        ConfigurationDto dto = new ConfigurationDto();
        dto.setId(cf.getId());
        dto.setName(cf.getName());
        dto.setSubcategory(cf.getSubcategory());
        if (cf.getCategory() != null) {
            dto.setCategoryId(cf.getCategory().getId());
            dto.setCategoryName(cf.getCategory().getName());
        }
        if (cf.getCreatedAt() != null) {
            dto.setCreatedAt(cf.getCreatedAt().format(DATE_FORMATTER));
        }
        if (cf.getUpdatedAt() != null) {
            dto.setUpdatedAt(cf.getUpdatedAt().format(DATE_FORMATTER));
        }
        return dto;
    }

    private ConfigurationDto toConfigurationDtoWithContent(ConfigurationFile cf) {
        ConfigurationDto dto = toConfigurationDto(cf);
        dto.setContentBase64(Base64.getEncoder().encodeToString(cf.getContent()));
        return dto;
    }
}
