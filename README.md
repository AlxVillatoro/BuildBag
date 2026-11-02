# BuildBag - Generador de Configuración .properties

Convierte un archivo `.properties` en un formulario guiado: cada propiedad se muestra con la explicación que traen sus propios comentarios, y al terminar descargas el archivo listo para usar.

## Cómo funciona

Hay un solo flujo:

1. **Abrir**: importa un `.properties` o `.json`, abre una configuración guardada o empieza una vacía.
2. **Revisar**: completa cada propiedad guiado por su descripción. El panel indica lo que falta.
3. **Guardar y descargar**: guarda en la base de datos y descarga el `.properties`.

Con **Editar estructura** se cambian, en esa misma pantalla, las categorías, las propiedades, sus descripciones, tipos y dependencias.

### Vistas

| | Guiada | Compacta |
|---|---|---|
| **Pensada para** | Revisar un archivo por primera vez | Cambiar valores en archivos grandes |
| **Propiedades** | Un bloque por propiedad, con su comentario a la vista | Tabla editable; `↑` `↓` y `Enter` recorren la columna |
| **Comentario** | Junto a cada propiedad | En un panel fijo que sigue a la fila seleccionada |
| **Dominios** | Una pestaña por dominio | Una columna por dominio, con las filas que difieren marcadas |

La vista elegida se recuerda en el navegador. Mientras "Editar estructura" está activo se usa siempre la guiada.

En ambas vistas, **Solo modificadas** filtra los valores distintos al original, **Restaurar** vuelve al valor que traía el archivo y **Copiar a todos los dominios** iguala ese valor en todas las columnas.

### Ordenar

En "Editar estructura", propiedades y categorías se reordenan arrastrando el asa `⠿` o con las flechas ↑ ↓, y "Ordenar A-Z" ordena una categoría por clave. Una propiedad también se puede arrastrar a otra categoría. El archivo generado respeta este orden.

### Cómo se leen los comentarios al importar

| En el archivo | En el panel |
|---|---|
| Comentario justo encima de una propiedad | Descripción de la propiedad |
| Título entre líneas `# -----`, o comentario corto aislado por líneas en blanco | Categoría |
| Comentario largo aislado | Se añade a la descripción de la siguiente propiedad |
| Claves `app.domain1.x`, `app.domain2.x` | Una propiedad por dominio, con el valor de cada uno |

Los archivos generados siguen este mismo formato, así que se pueden volver a importar sin perder comentarios ni categorías. El patrón de dominio (`domain{N}` por defecto) se cambia en los detalles de la configuración.

El tipo de campo se deduce del valor y de la clave: `true`/`false`, números, URL, HTML y contraseñas (`password`, `secret`, `token`...). Los valores `0` y `1` solo se tratan como interruptor si la clave lo sugiere (`enabled`, `activo`...).

## Requisitos

- JDK 8 para compilar y ejecutar (Micronaut 3.10)
- Maven 3.6+
- Node 22+ solo para los tests del frontend

## Construcción y ejecución

```bash
mvn clean package
java -jar target/buildbag-1.0.0.jar
```

La aplicación estará disponible en http://localhost:8080. El frontend no tiene paso de compilación ni dependencias externas: funciona sin acceso a internet.

## Perfiles de base de datos

H2 en archivo (`./data/buildbag`) es el predeterminado. SQL Server y Oracle toman los datos de conexión de variables de entorno, y exigen `JWT_SECRET` para no arrancar con el secreto de desarrollo:

```bash
export DB_URL="jdbc:sqlserver://HOST:1433;databaseName=DB"   # o jdbc:oracle:thin:@//HOST:1521/SERVICE
export DB_USERNAME=usuario
export DB_PASSWORD=clave
export JWT_SECRET=un-secreto-largo-de-al-menos-256-bits

java -Dmicronaut.environments=sqlserver -jar target/buildbag-1.0.0.jar   # o oracle
```

## Rutas

### Vistas
- `GET /` - Redirige a `/login`
- `GET /login`, `GET /register` - Acceso
- `GET /panel` - Panel de configuración (valida el JWT desde el navegador)

### API

Todas las rutas requieren `Authorization: Bearer <token>`, excepto registro y login. Los errores responden `{ "error": "mensaje" }`.

- `POST /api/auth/register`, `POST /api/auth/login` - Devuelven `{ "accessToken", "tokenType", "username" }`
  ```json
  { "username": "user", "password": "pass123" }
  ```
- `GET /api/auth/validate` - Comprueba el token
- `GET /api/categories` - Lista las categorías del usuario
- `POST /api/categories` - Crea una categoría, o devuelve la existente con ese nombre
- `DELETE /api/categories/{id}` - Elimina una categoría y sus configuraciones
- `GET /api/configs` - Lista las configuraciones (sin contenido)
- `GET /api/configs/with-categories` - Lista las categorías con sus configuraciones
- `GET /api/configs/{id}` - Obtiene una configuración, con su contenido en `contentBase64` (JSON en UTF-8)
- `POST /api/configs` - Crea una configuración
  ```json
  {
    "name": "Config Producción",
    "subcategory": "v1.0.0",
    "categoryId": 1,
    "json": "{\"projectName\": \"Mi Proyecto\", \"globalProperties\": []}"
  }
  ```
  En lugar de `categoryId` se puede enviar `categoryName`, que crea la categoría si no existe.
- `PUT /api/configs/{id}` - Actualiza los campos que se envíen
- `DELETE /api/configs/{id}` - Elimina una configuración

### Documentación de la API

- Swagger UI: http://localhost:8080/swagger-ui/index.html
- RapiDoc: http://localhost:8080/rapidoc/index.html
- ReDoc: http://localhost:8080/redoc/index.html
- OpenAPI: http://localhost:8080/swagger/buildbag-api-1.0.0.yml

## Estructura

```
src/main/java/com/ixlab/
├── controller/   Endpoints REST y vistas; el acceso se declara con @Secured
├── service/      Lógica de negocio
├── exception/    ApiException y el formato único de errores
├── domain/       Entidades JPA
├── dto/          Peticiones y respuestas
└── repository/   Micronaut Data

src/main/resources/
├── views/        auth.html (login y registro), panel.html y fragmentos comunes
└── static/
    ├── app.css
    └── js/
        ├── model.js       Modelo de la configuración: valores, validación, migración (sin DOM)
        ├── properties.js  Lectura y escritura del formato .properties (sin DOM)
        ├── render.js      HTML del panel
        ├── panel.js       Estado y acciones del panel
        ├── api.js         Sesión y llamadas al backend
        ├── auth.js, ui.js, theme.js
```

`model.js` es la única fuente de verdad: el formulario, el conteo de pendientes y el archivo generado recorren los mismos campos. Los valores se guardan en un mapa plano `clave concreta → valor`, igual que el propio `.properties`. Las configuraciones guardadas con versiones anteriores se migran al abrirlas.

## Pruebas

```bash
mvn test              # API e integración
node --test src/test/js   # Modelo y formato .properties
```

## Seguridad

Antes de producción:

1. Define `JWT_SECRET`
2. Usa una base de datos persistente (perfiles `sqlserver` u `oracle`)
3. Habilita HTTPS
4. Si se accede desde otros dominios, revisa la política de CORS

## Licencia

Apache-2.0
