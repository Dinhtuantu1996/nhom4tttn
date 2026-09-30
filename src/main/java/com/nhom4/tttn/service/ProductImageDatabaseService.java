package com.nhom4.tttn.service;

import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.entity.ProductImage;
import com.nhom4.tttn.repository.ProductImageRepository;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void create(Long productId, String filename) {
        Product product = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> new ProductNotFoundException(productId));

        ProductImage image = new ProductImage();
        image.setProduct(product);
        image.setFilename(filename);
        image.setDisplayOrder(imageRepository.findMaxDisplayOrderByProductId(productId) + 1);
        imageRepository.saveAndFlush(image);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean delete(Long productId, Long imageId) {
        Optional<ProductImage> image = imageRepository.findByIdAndProduct_Id(imageId, productId);
        if (image.isEmpty()) return true;

        imageRepository.delete(image.get());
        imageRepository.flush();
        return true;
    }

    public record ImageRef(Long id, String filename) {
    }
}
