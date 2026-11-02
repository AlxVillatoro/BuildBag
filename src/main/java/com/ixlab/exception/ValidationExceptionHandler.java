package com.ixlab.exception;

import io.micronaut.context.annotation.Replaces;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Produces;
import io.micronaut.http.server.exceptions.ExceptionHandler;
import io.micronaut.validation.exceptions.ConstraintExceptionHandler;
import jakarta.inject.Singleton;

import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import java.util.Collections;
import java.util.Map;

/** Reports bean validation failures with the same {"error": ...} body as every other API error. */
@Produces
@Singleton
@Replaces(ConstraintExceptionHandler.class)
public class ValidationExceptionHandler
        implements ExceptionHandler<ConstraintViolationException, HttpResponse<Map<String, String>>> {

    @Override
    public HttpResponse<Map<String, String>> handle(HttpRequest request, ConstraintViolationException exception) {
        String message = exception.getConstraintViolations().stream()
            .map(ConstraintViolation::getMessage)
            .findFirst()
            .orElse("Solicitud inválida");
        return HttpResponse.badRequest(Collections.singletonMap("error", message));
    }
}
