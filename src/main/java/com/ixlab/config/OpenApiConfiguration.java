package com.ixlab.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;

@OpenAPIDefinition(
    info = @Info(
        title = "BuildBag API",
        version = "1.0.0",
        description = "API para el generador de archivos de configuración .properties. " +
                      "Permite gestionar usuarios, categorías y configuraciones de forma segura.",
        contact = @Contact(
            name = "IxLab",
            email = "soporte@ixlab.com"
        ),
        license = @License(
            name = "Apache-2.0",
            url = "https://www.apache.org/licenses/LICENSE-2.0"
        )
    ),
    servers = {
        @Server(url = "/", description = "Servidor local")
    }
)
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT",
    description = "JWT authentication. Obtén un token haciendo login en /api/auth/login"
)
public class OpenApiConfiguration {
}

