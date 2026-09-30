package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.ProductForm;
import com.nhom4.tttn.entity.Attribute;
import com.nhom4.tttn.entity.Category;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.repository.AttributeRepository;
import com.nhom4.tttn.repository.CategoryRepository;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProductWriteService {
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final AttributeRepository attributeRepository;

    @Transactional
    public Product save(ProductForm form) {
        Product product = form.getId() == null
                ? new Product()
                : productRepository.findById(form.getId())
                .orElseThrow(() -> new ProductNotFoundException(form.getId()));

        List<Long> categoryIds = distinctIds(form.getCategoryIds());
        List<Category> categories = categoryRepository.findAllById(categoryIds);
        if (categories.isEmpty() || categories.size() != categoryIds.size()) {
            throw new IllegalArgumentException("Danh mục sản phẩm không hợp lệ.");
        }

        List<Long> attributeIds = distinctIds(form.getAttributeIds());
        List<Attribute> attributes = attributeRepository.findAllById(attributeIds);
        if (attributes.size() != attributeIds.size()) {
            throw new IllegalArgumentException("Có thuộc tính không tồn tại trong hệ thống.");
        }
        if (attributes.stream().anyMatch(Attribute::isRoot)) {
            throw new IllegalArgumentException("Sản phẩm chỉ được gán giá trị thuộc tính con.");
        }

        product.setName(normalize(form.getName()));
        product.setDescription(form.getDescription().trim());
        product.setPrice(form.getPrice());
        product.setQuantity(form.getQuantity());
        product.setCategories(new LinkedHashSet<>(categories));
        product.setAttributes(new LinkedHashSet<>(attributes));

        return productRepository.saveAndFlush(product);
    }

    private List<Long> distinctIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();

        Set<Long> unique = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) unique.add(id);
        }
        return List.copyOf(unique);
    }

    private String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ");
    }
}
