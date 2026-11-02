package com.ixlab.repository;

import com.ixlab.domain.ConfigurationFile;
import com.ixlab.dto.ConfigurationDto;
import io.micronaut.data.annotation.Query;
import io.micronaut.data.annotation.Repository;
import io.micronaut.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigurationFileRepository extends CrudRepository<ConfigurationFile, Long> {

    /** Listing projection: leaves the content BLOB out and fetches the category in a single query. */
    @Query("SELECT new com.ixlab.dto.ConfigurationDto(c.id, c.name, c.subcategory, cat.id, cat.name, c.createdAt, c.updatedAt) "
        + "FROM ConfigurationFile c LEFT JOIN c.category cat "
        + "WHERE c.owner.username = :username ORDER BY c.name")
    List<ConfigurationDto> findSummariesByOwner(String username);

    Optional<ConfigurationFile> findByIdAndOwnerUsername(Long id, String username);
}
