package com.ixlab;

import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;

import jakarta.inject.Inject;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.MediaType;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.client.exceptions.HttpClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@MicronautTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@SuppressWarnings({"rawtypes", "unchecked"})
public class IntegrationTest {

    @Inject
    @Client("/")
    HttpClient client;

    private String accessToken;
    private Long categoryId;
    private Long configId;

    @Test
    @Order(1)
    void testRegisterUser() {
        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "testuser");
        credentials.put("password", "testpass123");
        
        HttpRequest<Map<String, String>> request = HttpRequest.POST("/api/auth/register", credentials)
                .contentType(MediaType.APPLICATION_JSON_TYPE);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertTrue(body.containsKey("accessToken"), "Response should contain accessToken");
        
        accessToken = (String) body.get("accessToken");
        assertNotNull(accessToken);
        System.out.println("Register successful, token obtained");
    }

    @Test
    @Order(2)
    void testLoginUser() {
        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "testuser");
        credentials.put("password", "testpass123");
        
        HttpRequest<Map<String, String>> request = HttpRequest.POST("/api/auth/login", credentials)
                .contentType(MediaType.APPLICATION_JSON_TYPE);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertTrue(body.containsKey("accessToken"), "Response should contain accessToken");
        assertEquals("testuser", body.get("username"));
        
        accessToken = (String) body.get("accessToken");
        System.out.println("Login successful");
    }

    @Test
    @Order(3)
    void testLoginWithWrongPassword() {
        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "testuser");
        credentials.put("password", "wrongpassword");
        
        HttpRequest<Map<String, String>> request = HttpRequest.POST("/api/auth/login", credentials)
                .contentType(MediaType.APPLICATION_JSON_TYPE);
        
        assertThrows(HttpClientResponseException.class, () -> {
            client.toBlocking().exchange(request, Map.class);
        });
        
        System.out.println("Login with wrong password correctly rejected");
    }

    @Test
    @Order(4)
    void testCreateCategory() {
        Map<String, String> categoryData = new HashMap<>();
        categoryData.put("name", "Test Category");
        
        HttpRequest<Map<String, String>> request = HttpRequest.POST("/api/categories", categoryData)
                .contentType(MediaType.APPLICATION_JSON_TYPE)
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertNotNull(body.get("id"));
        assertEquals("Test Category", body.get("name"));
        
        categoryId = ((Number) body.get("id")).longValue();
        System.out.println("Category created with ID: " + categoryId);
    }

    @Test
    @Order(5)
    void testListCategories() {
        HttpRequest<?> request = HttpRequest.GET("/api/categories")
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<List> response = client.toBlocking().exchange(request, List.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        List<?> categories = response.getBody().get();
        assertFalse(categories.isEmpty(), "Categories list should not be empty");
        System.out.println("Categories list retrieved: " + categories.size() + " categories");
    }

    @Test
    @Order(6)
    void testCreateConfiguration() {
        Map<String, Object> configData = new HashMap<>();
        configData.put("name", "Test Config");
        configData.put("subcategory", "v1.0.0");
        configData.put("categoryId", categoryId);
        configData.put("json", "{\"projectName\":\"Test Project\",\"properties\":[]}");
        
        HttpRequest<Map<String, Object>> request = HttpRequest.POST("/api/configs", configData)
                .contentType(MediaType.APPLICATION_JSON_TYPE)
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertNotNull(body.get("id"));
        assertEquals("Test Config", body.get("name"));
        assertEquals("v1.0.0", body.get("subcategory"));
        
        configId = ((Number) body.get("id")).longValue();
        System.out.println("Configuration created with ID: " + configId);
    }

    @Test
    @Order(7)
    void testListConfigurations() {
        HttpRequest<?> request = HttpRequest.GET("/api/configs")
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<List> response = client.toBlocking().exchange(request, List.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        List<?> configs = response.getBody().get();
        assertFalse(configs.isEmpty(), "Configurations list should not be empty");
        System.out.println("Configurations list retrieved: " + configs.size() + " configs");
    }

    @Test
    @Order(8)
    void testGetConfigurationById() {
        HttpRequest<?> request = HttpRequest.GET("/api/configs/" + configId)
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertEquals(configId.intValue(), ((Number) body.get("id")).intValue());
        assertEquals("Test Config", body.get("name"));
        assertNotNull(body.get("contentBase64"), "Should include contentBase64");
        System.out.println("Configuration retrieved by ID");
    }

    @Test
    @Order(9)
    void testGetConfigurationsWithCategories() {
        HttpRequest<?> request = HttpRequest.GET("/api/configs/with-categories")
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<List> response = client.toBlocking().exchange(request, List.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        List<?> categories = response.getBody().get();
        assertFalse(categories.isEmpty(), "Categories with configurations should not be empty");
        
        Map<?, ?> firstCategory = (Map<?, ?>) categories.get(0);
        assertNotNull(firstCategory.get("configurations"));
        System.out.println("Categories with configurations retrieved");
    }

    @Test
    @Order(10)
    void testUpdateConfiguration() {
        Map<String, Object> updateData = new HashMap<>();
        updateData.put("name", "Updated Config");
        updateData.put("subcategory", "v2.0.0");
        
        HttpRequest<Map<String, Object>> request = HttpRequest.PUT("/api/configs/" + configId, updateData)
                .contentType(MediaType.APPLICATION_JSON_TYPE)
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertEquals("Updated Config", body.get("name"));
        assertEquals("v2.0.0", body.get("subcategory"));
        System.out.println("Configuration updated successfully");
    }

    @Test
    @Order(11)
    void testDeleteConfiguration() {
        HttpRequest<?> request = HttpRequest.DELETE("/api/configs/" + configId)
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertEquals(true, body.get("deleted"));
        System.out.println("Configuration deleted successfully");
    }

    @Test
    @Order(12)
    void testDeleteCategory() {
        HttpRequest<?> request = HttpRequest.DELETE("/api/categories/" + categoryId)
                .header("Authorization", "Bearer " + accessToken);
        
        HttpResponse<Map> response = client.toBlocking().exchange(request, Map.class);
        
        assertEquals(200, response.getStatus().getCode());
        assertTrue(response.getBody().isPresent());
        
        Map<?, ?> body = response.getBody().get();
        assertEquals(true, body.get("deleted"));
        System.out.println("Category deleted successfully");
    }

    @Test
    @Order(13)
    void testUnauthorizedAccess() {
        HttpRequest<?> request = HttpRequest.GET("/api/configs");
        
        assertThrows(HttpClientResponseException.class, () -> {
            client.toBlocking().exchange(request, List.class);
        }, "Should throw unauthorized exception when no token provided");
        
        System.out.println("Unauthorized access correctly rejected");
    }

    @Test
    @Order(14)
    void testRegisterWithShortUsername() {
        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "ab");  // Too short
        credentials.put("password", "testpass123");
        
        HttpRequest<Map<String, String>> request = HttpRequest.POST("/api/auth/register", credentials)
                .contentType(MediaType.APPLICATION_JSON_TYPE);
        
        HttpClientResponseException exception = assertThrows(HttpClientResponseException.class, () -> {
            client.toBlocking().exchange(request, Map.class);
        });
        
        assertEquals(400, exception.getStatus().getCode());
        System.out.println("Short username correctly rejected");
    }

    @Test
    @Order(15)
    void testRegisterWithShortPassword() {
        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "newuser");
        credentials.put("password", "12345");  // Too short
        
        HttpRequest<Map<String, String>> request = HttpRequest.POST("/api/auth/register", credentials)
                .contentType(MediaType.APPLICATION_JSON_TYPE);
        
        HttpClientResponseException exception = assertThrows(HttpClientResponseException.class, () -> {
            client.toBlocking().exchange(request, Map.class);
        });
        
        assertEquals(400, exception.getStatus().getCode());
        System.out.println("Short password correctly rejected");
    }

    @Test
    @Order(16)
    void testRegisterExistingUsernameIsConflict() {
        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "testuser");
        credentials.put("password", "testpass123");

        HttpClientResponseException exception = assertThrows(HttpClientResponseException.class, () -> {
            client.toBlocking().exchange(HttpRequest.POST("/api/auth/register", credentials), Map.class);
        });

        assertEquals(409, exception.getStatus().getCode());
        assertTrue(exception.getResponse().getBody(Map.class).isPresent());
        assertNotNull(exception.getResponse().getBody(Map.class).get().get("error"));
    }

    @Test
    @Order(17)
    void testUpdateKeepsSingleConfigurationAndAcceptsCategoryName() {
        Long id = createConfig(accessToken, "Original", "{\"a\":1}");
        int before = list("/api/configs", accessToken).size();

        Map<String, Object> update = new HashMap<>();
        update.put("json", "{\"a\":2}");
        update.put("categoryName", "Movida");
        Map<?, ?> updated = client.toBlocking().retrieve(
            HttpRequest.PUT("/api/configs/" + id, update).header("Authorization", "Bearer " + accessToken), Map.class);

        assertEquals("Movida", updated.get("categoryName"));
        assertEquals(before, list("/api/configs", accessToken).size(), "Updating must not create a copy");
        assertEquals("{\"a\":2}", content(id));
    }

    @Test
    @Order(18)
    void testContentKeepsNonAsciiCharacters() {
        String json = "{\"projectName\":\"Configuración de año ñandú\"}";
        assertEquals(json, content(createConfig(accessToken, "Acentos", json)));
    }

    @Test
    @Order(19)
    void testCreateCategoryWithSameNameReturnsExisting() {
        Map<String, String> body = new HashMap<>();
        body.put("name", "Unica");
        HttpRequest<?> first = HttpRequest.POST("/api/categories", body).header("Authorization", "Bearer " + accessToken);
        HttpRequest<?> second = HttpRequest.POST("/api/categories", body).header("Authorization", "Bearer " + accessToken);

        assertEquals(
            client.toBlocking().retrieve(first, Map.class).get("id"),
            client.toBlocking().retrieve(second, Map.class).get("id"));
    }

    @Test
    @Order(20)
    void testUsersCannotReachEachOthersData() {
        Long victimConfig = createConfig(accessToken, "Privada", "{}");
        Map<String, String> victimCategory = new HashMap<>();
        victimCategory.put("name", "Privada");
        Long victimCategoryId = ((Number) client.toBlocking().retrieve(
            HttpRequest.POST("/api/categories", victimCategory).header("Authorization", "Bearer " + accessToken),
            Map.class).get("id")).longValue();

        Map<String, String> credentials = new HashMap<>();
        credentials.put("username", "otheruser");
        credentials.put("password", "testpass123");
        String otherToken = (String) client.toBlocking().retrieve(
            HttpRequest.POST("/api/auth/register", credentials), Map.class).get("accessToken");

        assertStatus(404, HttpRequest.GET("/api/configs/" + victimConfig).header("Authorization", "Bearer " + otherToken));
        assertStatus(404, HttpRequest.DELETE("/api/configs/" + victimConfig).header("Authorization", "Bearer " + otherToken));
        assertStatus(404, HttpRequest.DELETE("/api/categories/" + victimCategoryId).header("Authorization", "Bearer " + otherToken));

        Map<String, Object> intoVictimCategory = new HashMap<>();
        intoVictimCategory.put("name", "Intrusa");
        intoVictimCategory.put("categoryId", victimCategoryId);
        intoVictimCategory.put("json", "{}");
        assertStatus(404, HttpRequest.POST("/api/configs", intoVictimCategory).header("Authorization", "Bearer " + otherToken));
        assertTrue(list("/api/configs", otherToken).isEmpty());
    }

    @Test
    @Order(21)
    void testPublicPagesAndAssetsNeedNoToken() {
        assertEquals(200, client.toBlocking().exchange(HttpRequest.GET("/login"), String.class).getStatus().getCode());
        assertEquals(200, client.toBlocking().exchange(HttpRequest.GET("/register"), String.class).getStatus().getCode());
        assertEquals(200, client.toBlocking().exchange(HttpRequest.GET("/panel"), String.class).getStatus().getCode());
        assertEquals(200, client.toBlocking().exchange(HttpRequest.GET("/static/app.css"), String.class).getStatus().getCode());
    }

    private Long createConfig(String token, String name, String json) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("categoryName", "Pruebas");
        body.put("json", json);
        Map<?, ?> created = client.toBlocking().retrieve(
            HttpRequest.POST("/api/configs", body).header("Authorization", "Bearer " + token), Map.class);
        return ((Number) created.get("id")).longValue();
    }

    private List<?> list(String path, String token) {
        return client.toBlocking().retrieve(HttpRequest.GET(path).header("Authorization", "Bearer " + token), List.class);
    }

    private String content(Long id) {
        Map<?, ?> config = client.toBlocking().retrieve(
            HttpRequest.GET("/api/configs/" + id).header("Authorization", "Bearer " + accessToken), Map.class);
        return new String(Base64.getDecoder().decode((String) config.get("contentBase64")), StandardCharsets.UTF_8);
    }

    private void assertStatus(int status, HttpRequest<?> request) {
        HttpClientResponseException exception = assertThrows(HttpClientResponseException.class, () -> {
            client.toBlocking().exchange(request, Map.class);
        });
        assertEquals(status, exception.getStatus().getCode());
    }
}
