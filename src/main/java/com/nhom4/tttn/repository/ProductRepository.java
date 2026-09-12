package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.Product;
import org.springframework.data.jpa.repository.EntityGraph;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    boolean existsByCategories_Id(Long categoryId);

    boolean existsByAttributes_Id(Long attributeId);

    @EntityGraph(attributePaths = "images")
    Optional<Product> findDetailedById(Long id);

    @EntityGraph(attributePaths = "images")
    List<Product> findTop8ByOrderByUpdatedDateDesc();

    @EntityGraph(attributePaths = "images")
    List<Product> findAllByIdIn(Collection<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);
}
