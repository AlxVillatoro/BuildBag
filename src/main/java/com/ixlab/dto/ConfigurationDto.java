package com.ixlab.dto;

import com.ixlab.domain.Category;
import com.ixlab.domain.ConfigurationFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class ConfigurationDto {
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private Long id;
    private String name;
    private String subcategory;
    private Long categoryId;
    private String categoryName;
    private String contentBase64;
    private String createdAt;
    private String updatedAt;

    public ConfigurationDto() {}

    public ConfigurationDto(Long id, String name, String subcategory, Long categoryId, String categoryName,
                            LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.name = name;
        this.subcategory = subcategory;
        this.categoryId = categoryId;
        this.categoryName = categoryName;
        this.createdAt = createdAt == null ? null : createdAt.format(DATE_FORMATTER);
        this.updatedAt = updatedAt == null ? null : updatedAt.format(DATE_FORMATTER);
    }

    public static ConfigurationDto from(ConfigurationFile config) {
        Category category = config.getCategory();
        return new ConfigurationDto(config.getId(), config.getName(), config.getSubcategory(),
            category == null ? null : category.getId(), category == null ? null : category.getName(),
            config.getCreatedAt(), config.getUpdatedAt());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSubcategory() { return subcategory; }
    public void setSubcategory(String subcategory) { this.subcategory = subcategory; }

    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }

    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public String getContentBase64() { return contentBase64; }
    public void setContentBase64(String contentBase64) { this.contentBase64 = contentBase64; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
