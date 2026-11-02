package com.ixlab.dto;

import io.micronaut.core.annotation.Introspected;

import javax.validation.constraints.NotBlank;

@Introspected
public class CreateCategoryRequest {
    @NotBlank(message = "El nombre de la categoría es obligatorio")
    private String name;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
