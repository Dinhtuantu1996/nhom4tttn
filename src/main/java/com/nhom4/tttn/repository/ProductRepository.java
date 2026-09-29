package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.Product;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    boolean existsByCategories_Id(Long categoryId);

    boolean existsByAttributes_Id(Long attributeId);

    @EntityGraph(attributePaths = "images")
    Optional<Product> findDetailedById(Long id);

    @EntityGraph(attributePaths = "images")
    List<Product> findTop8ByEnableTrueOrderByUpdatedDateDesc();

    @EntityGraph(attributePaths = "images")
    List<Product> findAllByIdIn(Collection<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);
}
