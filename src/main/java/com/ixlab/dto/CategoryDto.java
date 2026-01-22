package com.ixlab.dto;

import java.util.List;

public class CategoryDto {
    private Long id;
    private String name;
    private List<ConfigurationDto> configurations;

    public CategoryDto() {}

    public CategoryDto(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<ConfigurationDto> getConfigurations() { return configurations; }
    public void setConfigurations(List<ConfigurationDto> configurations) { this.configurations = configurations; }
}

