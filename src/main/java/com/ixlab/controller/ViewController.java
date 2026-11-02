package com.ixlab.controller;

import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.rules.SecurityRule;
import io.micronaut.views.View;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/** Serves the page shells; the panel verifies the JWT from JavaScript through /api/auth/validate. */
@Controller
@Secured(SecurityRule.IS_ANONYMOUS)
public class ViewController {

    @Get("/")
    public HttpResponse<?> index() {
        return HttpResponse.seeOther(URI.create("/login"));
    }

    @Get("/login")
    @View("auth")
    public Map<String, Object> login() {
        return model("Iniciar sesión - BuildBag", "login");
    }

    @Get("/register")
    @View("auth")
    public Map<String, Object> register() {
        return model("Crear cuenta - BuildBag", "register");
    }

    @Get("/panel")
    @View("panel")
    public Map<String, Object> panel() {
        return model("Panel de configuración - BuildBag", "panel");
    }

    private Map<String, Object> model(String title, String mode) {
        Map<String, Object> model = new HashMap<>();
        model.put("title", title);
        model.put("mode", mode);
        return model;
    }
}
