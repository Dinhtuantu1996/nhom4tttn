package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.ProductForm;
import com.nhom4.tttn.dto.ProductImage;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.enums.ProductAgeGroup;
import com.nhom4.tttn.enums.ProductGender;
import com.nhom4.tttn.repository.ProductImageRepository;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import com.nhom4.tttn.entity.Category;
import com.nhom4.tttn.repository.CategoryRepository;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final ProductImageRepository imageRepository;
    private final CategoryRepository categoryRepository;
    private final LocalFileStorageService fileStorage;

    @Transactional(readOnly = true)
    public Page<Product> search(
            String keyword,
            Long categoryId,
            ProductGender gender,
            ProductAgeGroup ageGroup,
            String sort,
            int page,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 6), 60);
        int safePage = Math.max(page, 0);
        Pageable pageable = PageRequest.of(safePage, safeSize, sortOf(sort));

        Specification<Product> spec = Specification.unrestricted();
        if (keyword != null && !keyword.isBlank()) {
            String value = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("name")), value));
        }
        if (categoryId != null) {
            spec = spec.and((root, query, cb) -> {
                query.distinct(true);
                var categories = root.join("categories", JoinType.INNER);
                return cb.or(
                        cb.equal(categories.get("id"), categoryId),
                        cb.equal(categories.join("parent", JoinType.LEFT).get("id"), categoryId)
                );
            });
        }
        if (gender != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("gender"), gender));
        }
        if (ageGroup != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("ageGroup"), ageGroup));
        }
        return productRepository.findAll(spec, pageable);
    }

    @Transactional(readOnly = true)
    public Product getDetailed(Long id) {
        return productRepository.findDetailedById(id)
                .orElseThrow(() -> new IllegalArgumentException("Khong tim thay san pham ID " + id));
    }

    @Transactional
    public Product view(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Khong tim thay san pham ID " + id));
        product.setViewCount(product.getViewCount() + 1);
        productRepository.save(product);
        return getDetailed(id);
    }

    @Transactional(readOnly = true)
    public List<Product> newest() {
        return productRepository.findTop8ByOrderByUpdatedDateDesc();
    }

    @Transactional
    public Product save(ProductForm form, List<MultipartFile> files) {
        Product product = form.getId() == null ? new Product() : getDetailed(form.getId());
        List<Long> categoryIds = form.getCategoryIds() == null ? List.of() : form.getCategoryIds().stream().distinct().toList();
        List<Category> categories = categoryRepository.findAllById(categoryIds);
        if (categories.isEmpty() || categories.size() != categoryIds.size()) {
            throw new IllegalArgumentException("Danh muc san pham khong hop le.");
        }

        product.setName(normalize(form.getName()));
        product.setDescription(form.getDescription().trim());
        product.setGender(form.getGender());
        product.setAgeGroup(form.getAgeGroup());
        product.setCategories(new LinkedHashSet<>(categories));
        product = productRepository.saveAndFlush(product);

        deleteImages(product, form.getDeleteImageIds());
        saveImages(product, files);
        return product;
    }

    @Transactional
    public void delete(Long id) {
        Product product = getDetailed(id);
        productRepository.delete(product);
        productRepository.flush();
        fileStorage.deleteProductFolder(id);
    }

    public ProductForm toForm(Product product) {
        ProductForm form = new ProductForm();
        form.setId(product.getId());
        form.setName(product.getName());
        form.setDescription(product.getDescription());
        form.setGender(product.getGender());
        form.setAgeGroup(product.getAgeGroup());
        form.setCategoryIds(product.getCategories().stream().map(Category::getId).toList());
        return form;
    }

    private void saveImages(Product product, List<MultipartFile> files) {
        if (files == null) return;
        int order = imageRepository.countByProduct_Id(product.getId());
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) continue;
            String filename = fileStorage.storeProductFile(product.getId(), file);
            var existing = imageRepository.findByProduct_IdAndFilename(product.getId(), filename);
            if (existing.isPresent()) continue;

            ProductImage image = new ProductImage();
            image.setProduct(product);
            image.setFilename(filename);
            image.setDisplayOrder(order++);
            imageRepository.save(image);
        }
    }

    private void deleteImages(Product product, List<Long> imageIds) {
        if (imageIds == null) return;
        for (Long imageId : new LinkedHashSet<>(imageIds)) {
            imageRepository.findByIdAndProduct_Id(imageId, product.getId()).ifPresent(image -> {
                fileStorage.deleteProductFile(product.getId(), image.getFilename());
                imageRepository.delete(image);
            });
        }
    }

    private Sort sortOf(String value) {
        return switch (value == null ? "newest" : value) {
            case "oldest" -> Sort.by(Sort.Direction.ASC, "createdDate").and(Sort.by("id"));
            case "name" -> Sort.by(Sort.Direction.ASC, "name").and(Sort.by("id"));
            case "views" -> Sort.by(Sort.Direction.DESC, "viewCount").and(Sort.by(Sort.Direction.DESC, "id"));
            default -> Sort.by(Sort.Direction.DESC, "updatedDate").and(Sort.by(Sort.Direction.DESC, "id"));
        };
    }

    private String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ");
    }
}
