package com.nhom4.tttn.repository;

import com.nhom4.tttn.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    Optional<ProductImage> findByIdAndProduct_Id(Long imageId, Long productId);

    @Query("select coalesce(max(i.displayOrder), -1) from ProductImage i where i.product.id = :productId")
    int findMaxDisplayOrderByProductId(@Param("productId") Long productId);
}
