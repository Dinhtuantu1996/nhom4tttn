package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.ProductForm;
import com.nhom4.tttn.dto.ProductImage;
import com.nhom4.tttn.entity.Attribute;
import com.nhom4.tttn.entity.Category;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.repository.AttributeRepository;
import com.nhom4.tttn.repository.CategoryRepository;
import com.nhom4.tttn.repository.ProductImageRepository;
import com.nhom4.tttn.repository.ProductRepository;
import jakarta.persistence.criteria.JoinType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final ProductImageRepository imageRepository;
    private final CategoryRepository categoryRepository;
    private final AttributeRepository attributeRepository;
    private final LocalFileStorageService fileStorage;
    private final ProductSqlDeleteService productSqlDeleteService;

    @Transactional(readOnly = true)
    public Page<Product> search(
            String keyword,
            Long categoryId,
            List<Long> attributeIds,
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

        for (List<Long> groupIds : groupSelectedAttributeIds(attributeIds)) {
            spec = spec.and((root, query, cb) -> {
                var subquery = query.subquery(Long.class);
                var correlatedProduct = subquery.correlate(root);
                var attributes = correlatedProduct.join("attributes", JoinType.INNER);
                subquery.select(cb.literal(1L));
                subquery.where(attributes.get("id").in(groupIds));
                return cb.exists(subquery);
            });
        }

        return productRepository.findAll(spec, pageable);
    }

    @Transactional(readOnly = true)
    public Product getDetailed(Long id) {
        Product product = productRepository.findDetailedById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm ID " + id));

        product.getCategories().size();
        product.getAttributes().forEach(attribute -> {
            if (attribute.getParent() != null) {
                attribute.getParent().getId();
            }
        });
        return product;
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
    public List<Product> latestUpdated() {
        return productRepository.findTop8ByOrderByUpdatedDateDesc();
    }

    @Transactional
    public Product save(ProductForm form, List<MultipartFile> files) {
        Product product = form.getId() == null ? new Product() : getDetailed(form.getId());

        List<Long> categoryIds = distinctIds(form.getCategoryIds());
        List<Category> categories = categoryRepository.findAllById(categoryIds);
        if (categories.isEmpty() || categories.size() != categoryIds.size()) {
            throw new IllegalArgumentException("Danh muc san pham khong hop le.");
        }

        List<Long> attributeIds = distinctIds(form.getAttributeIds());
        List<Attribute> attributes = attributeRepository.findAllById(attributeIds);
        if (attributes.size() != attributeIds.size()) {
            throw new IllegalArgumentException("Co thuoc tinh khong ton tai trong he thong.");
        }
        if (attributes.stream().anyMatch(Attribute::isRoot)) {
            throw new IllegalArgumentException("San pham chi duoc gan gia tri thuoc tinh con.");
        }

        product.setName(normalize(form.getName()));
        product.setDescription(form.getDescription().trim());
        product.setPrice(form.getPrice());
        product.setQuantity(form.getQuantity());
        product.setCategories(new LinkedHashSet<>(categories));
        product.setAttributes(new LinkedHashSet<>(attributes));
        product = productRepository.saveAndFlush(product);

        deleteImages(product, form.getDeleteImageIds());
        saveImages(product, files);
        return product;
    }

    public void delete(Long id) {
        if (!productRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy sản phẩm ID " + id);
        }

        fileStorage.deleteProductFolder(id);
        productSqlDeleteService.deleteProductData(id);
    }

    public ProductForm toForm(Product product) {
        ProductForm form = new ProductForm();
        form.setId(product.getId());
        form.setName(product.getName());
        form.setDescription(product.getDescription());
        form.setPrice(product.getPrice());
        form.setQuantity(product.getQuantity());
        form.setCategoryIds(product.getCategories().stream().map(Category::getId).toList());
        form.setAttributeIds(product.getAttributes().stream().map(Attribute::getId).toList());
        return form;
    }

    private List<List<Long>> groupSelectedAttributeIds(List<Long> rawIds) {
        List<Long> ids = distinctIds(rawIds);
        if (ids.isEmpty()) return List.of();

        List<Attribute> selected = attributeRepository.findAllById(ids);
        if (selected.size() != ids.size() || selected.stream().anyMatch(Attribute::isRoot)) {
            return List.of(List.of(-1L));
        }

        Map<Long, List<Long>> grouped = new LinkedHashMap<>();
        for (Attribute attribute : selected) {
            grouped.computeIfAbsent(attribute.getParent().getId(), ignored -> new ArrayList<>())
                    .add(attribute.getId());
        }
        return new ArrayList<>(grouped.values());
    }

    private List<Long> distinctIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        Set<Long> unique = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) unique.add(id);
        }
        return List.copyOf(unique);
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
            default -> Sort.by(Sort.Direction.DESC, "createdDate").and(Sort.by(Sort.Direction.DESC, "id"));
        };
    }

    private String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ");
    }
}
