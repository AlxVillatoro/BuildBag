# BuildBag - Generador de Configuración .properties

Proyecto Micronaut con Thymeleaf para gestionar configuraciones JSON por usuario.

## Características

- **Autenticación**: Registro / login de usuarios con JWT
- **Vistas Thymeleaf**: Login, registro y panel de configuración
- **Modo Dark/Light**: Toggle para cambiar entre temas
- **Categorías y Subcategorías**: Organización de configuraciones por categoría (empresa, proyecto) y subcategoría (versión)
- **Persistencia**: JPA/Hibernate; soporta H2 (default), SQL Server y Oracle mediante perfiles
- **Almacenamiento**: JSON almacenados como BLOB en la base de datos
- **API REST**: Endpoints documentados con OpenAPI/Swagger
- **Importación**: Soporte para importar archivos JSON o .properties

## Requisitos

- Java 8+
- Maven 3.6+

## Construcción y Ejecución

```bash
mvn clean package
java -jar target/buildbag-1.0.0.jar
```

La aplicación estará disponible en: http://localhost:8080

## Perfiles de Base de Datos

### H2 (Default - Desarrollo)
```bash
java -jar target/buildbag-1.0.0.jar
```

### SQL Server
```bash
java -Dmicronaut.environments=sqlserver -jar target/buildbag-1.0.0.jar
```

### Oracle
```bash
java -Dmicronaut.environments=oracle -jar target/buildbag-1.0.0.jar
```

## Rutas de la Aplicación

### Vistas (Thymeleaf)
- `GET /` - Redirige a login
- `GET /login` - Página de inicio de sesión
- `GET /register` - Página de registro
- `GET /panel` - Panel principal de configuración (requiere autenticación)

### API de Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
  ```json
  { "username": "user", "password": "pass123" }
  ```
- `POST /api/auth/login` - Iniciar sesión y obtener token JWT
  ```json
  { "username": "user", "password": "pass123" }
  ```
  Respuesta:
  ```json
  { "accessToken": "eyJ...", "tokenType": "Bearer", "username": "user" }
  ```

### API de Categorías (Requiere JWT)
- `GET /api/categories` - Listar categorías del usuario
- `POST /api/categories` - Crear nueva categoría
  ```json
  { "name": "Mi Empresa" }
  ```
- `DELETE /api/categories/{id}` - Eliminar categoría

### API de Configuraciones (Requiere JWT)
- `GET /api/configs` - Listar configuraciones del usuario
- `GET /api/configs/{id}` - Obtener configuración específica (incluye contentBase64)
- `GET /api/configs/with-categories` - Listar categorías con sus configuraciones
- `POST /api/configs` - Crear nueva configuración
  ```json
  {
    "name": "Config Producción",
    "subcategory": "v1.0.0",
    "categoryId": 1,
    "json": "{\"projectName\": \"Mi Proyecto\", \"properties\": []}"
  }
  ```
- `PUT /api/configs/{id}` - Actualizar configuración
- `DELETE /api/configs/{id}` - Eliminar configuración

## Documentación API (Swagger/OpenAPI)

- **Swagger UI**: http://localhost:8080/swagger
- **RapiDoc**: http://localhost:8080/rapidoc
- **ReDoc**: http://localhost:8080/redoc
- **OpenAPI JSON**: http://localhost:8080/openapi

## Autenticación

Todas las rutas de API (excepto `/api/auth/*`) requieren un token JWT en el header:

```
Authorization: Bearer eyJ...
```

## Estructura del Proyecto

```
src/main/java/com/ixlab/
├── Application.java
├── config/
│   ├── OpenApiConfiguration.java
│   └── SecurityConfiguration.java
├── controller/
│   ├── AuthController.java
│   ├── CategoryController.java
│   ├── ConfigController.java
│   └── ViewController.java
├── domain/
│   ├── Category.java
│   ├── ConfigurationFile.java
│   └── User.java
├── dto/
│   ├── AuthResponse.java
│   ├── CategoryDto.java
│   ├── ConfigurationDto.java
│   ├── LoginRequest.java
│   ├── RegisterRequest.java
│   └── SaveConfigurationRequest.java
├── repository/
│   ├── CategoryRepository.java
│   ├── ConfigurationFileRepository.java
│   └── UserRepository.java
├── security/
│   └── AuthenticationProviderUserPassword.java
└── service/
    ├── ConfigurationService.java
    ├── JwtService.java
    └── UserService.java

src/main/resources/
├── views/
│   ├── login.html
│   ├── register.html
│   └── config.html
├── static/
│   └── config.js
├── application.yml
├── application-sqlserver.yml
└── application-oracle.yml
```

## Testing

```bash
mvn test
```

## Configuración

Edita `src/main/resources/application.yml` para configurar:

- **Puerto del servidor**: `micronaut.server.port`
- **Secreto JWT**: `micronaut.security.token.jwt.signatures.secret.generator.secret`
- **Base de datos**: `datasources.default.*`

## Seguridad

⚠️ **Antes de producción**:
1. Cambia el secreto JWT (`JWT_SECRET` o en application.yml)
2. Configura una base de datos persistente (SQL Server/Oracle/PostgreSQL)
3. Habilita HTTPS
4. Revisa las políticas de CORS si se accede desde otros dominios

## Licencia

MIT License
