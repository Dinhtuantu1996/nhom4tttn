package com.nhom4.tttn.service;

import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.entity.ProductImage;
import com.nhom4.tttn.repository.ProductImageRepository;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductImageDatabaseService {
    private final ProductImageRepository imageRepository;
    private final ProductRepository productRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Optional<ImageRef> find(Long productId, Long imageId) {
        return imageRepository.findByIdAndProduct_Id(imageId, productId)
                .map(image -> new ImageRef(image.getId(), image.getFilename()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public long count(Long productId) {
        return imageRepository.countByProductId(productId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public long countExisting(Long productId, Collection<Long> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) return 0;
        return imageRepository.countByProductIdAndIds(productId, imageIds);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean create(Long productId, String filename, int maxImages) {
        Product product = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> new ProductNotFoundException(productId));

        if (imageRepository.countByProductId(productId) >= maxImages) {
            return false;
        }

        ProductImage image = new ProductImage();
        image.setProduct(product);
        image.setFilename(filename);
        image.setDisplayOrder(imageRepository.findMaxDisplayOrderByProductId(productId) + 1);
        imageRepository.saveAndFlush(image);
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean delete(Long productId, Long imageId) {
        imageRepository.deleteByIdAndProductId(imageId, productId);
        return !imageRepository.existsByIdAndProduct_Id(imageId, productId);
    }

    public record ImageRef(Long id, String filename) {
    }
}
