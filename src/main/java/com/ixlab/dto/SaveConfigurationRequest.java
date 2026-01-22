package com.ixlab.dto;

public class SaveConfigurationRequest {
    private String name;
    private String subcategory;
    private Long categoryId;
    private String categoryName;
    private String json;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSubcategory() { return subcategory; }
    public void setSubcategory(String subcategory) { this.subcategory = subcategory; }

    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }

    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public String getJson() { return json; }
    public void setJson(String json) { this.json = json; }
}

