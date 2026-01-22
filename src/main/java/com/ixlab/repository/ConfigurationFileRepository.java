package com.ixlab.repository;

import com.ixlab.domain.ConfigurationFile;
import io.micronaut.data.annotation.Repository;
import io.micronaut.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigurationFileRepository extends CrudRepository<ConfigurationFile, Long> {
    List<ConfigurationFile> findByOwnerId(Long ownerId);
    List<ConfigurationFile> findByCategoryId(Long categoryId);
    List<ConfigurationFile> findByOwnerIdAndCategoryId(Long ownerId, Long categoryId);
    Optional<ConfigurationFile> findByIdAndOwnerId(Long id, Long ownerId);
    boolean existsByNameAndSubcategoryAndCategoryIdAndOwnerId(String name, String subcategory, Long categoryId, Long ownerId);
}
