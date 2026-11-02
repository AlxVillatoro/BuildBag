package com.ixlab.repository;

import com.ixlab.domain.Category;
import io.micronaut.data.annotation.Repository;
import io.micronaut.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends CrudRepository<Category, Long> {
    List<Category> findByOwnerUsernameOrderByName(String username);
    Optional<Category> findByNameAndOwnerUsername(String name, String username);
    Optional<Category> findByIdAndOwnerUsername(Long id, String username);
}
