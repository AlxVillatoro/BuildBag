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
}
