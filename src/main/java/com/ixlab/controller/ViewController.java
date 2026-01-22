package com.ixlab.controller;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.views.View;

import java.util.HashMap;
import java.util.Map;

@Controller
public class ViewController {

    @Get("/login")
    @Secured(SecurityRule.IS_ANONYMOUS)
    @View("login")
    public Map<String, Object> login() {
        Map<String, Object> model = new HashMap<>();
        model.put("title", "Iniciar Sesión - BuildBag");
        return model;
    }

    @Get("/register")
    @Secured(SecurityRule.IS_ANONYMOUS)
    @View("register")
    public Map<String, Object> register() {
        Map<String, Object> model = new HashMap<>();
        model.put("title", "Registrarse - BuildBag");
        return model;
    }

    @Get("/")
    @Secured(SecurityRule.IS_ANONYMOUS)
    @View("login")
    public Map<String, Object> index() {
        Map<String, Object> model = new HashMap<>();
        model.put("title", "Iniciar Sesión - BuildBag");
        return model;
    }

    @Get("/panel")
    @Secured(SecurityRule.IS_ANONYMOUS)
    @View("config")
    public Map<String, Object> panel() {
        Map<String, Object> model = new HashMap<>();
        model.put("title", "Panel de Configuración - BuildBag");
        return model;
    }
}

