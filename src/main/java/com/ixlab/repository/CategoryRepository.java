package com.ixlab.repository;

import com.ixlab.domain.Category;
import io.micronaut.data.annotation.Repository;
import io.micronaut.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends CrudRepository<Category, Long> {
    List<Category> findByOwnerId(Long ownerId);
    Optional<Category> findByNameAndOwnerId(String name, Long ownerId);
    boolean existsByNameAndOwnerId(String name, Long ownerId);
}

