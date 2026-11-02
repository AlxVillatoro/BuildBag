package com.ixlab.exception;

import io.micronaut.context.annotation.Requires;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Produces;
import io.micronaut.http.server.exceptions.ExceptionHandler;
import jakarta.inject.Singleton;

import java.util.Collections;
import java.util.Map;

@Produces
@Singleton
@Requires(classes = {ApiException.class, ExceptionHandler.class})
public class ApiExceptionHandler implements ExceptionHandler<ApiException, HttpResponse<Map<String, String>>> {

    @Override
    public HttpResponse<Map<String, String>> handle(HttpRequest request, ApiException exception) {
        return HttpResponse.<Map<String, String>>status(exception.getStatus())
            .body(Collections.singletonMap("error", exception.getMessage()));
    }
}
