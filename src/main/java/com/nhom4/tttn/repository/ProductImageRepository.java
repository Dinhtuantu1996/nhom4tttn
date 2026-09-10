package com.nhom4.tttn.repository;

import com.nhom4.tttn.dto.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    Optional<ProductImage> findByIdAndProduct_Id(Long imageId, Long productId);
    Optional<ProductImage> findByProduct_IdAndFilename(Long productId, String filename);
    int countByProduct_Id(Long productId);
}
