package com.nhom4.tttn.service;

import com.nhom4.tttn.entity.Category;
import com.nhom4.tttn.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import com.nhom4.tttn.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<Category> roots() {
        return categoryRepository.findByParentIsNullOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public List<Category> all() {
        return categoryRepository.findAllByOrderByNameAsc();
    }

    @Transactional
    public Category save(Long id, String rawName, Long parentId) {
        String name = normalizeName(rawName);
        Category category = id == null ? new Category() : get(id);
        Category parent = null;

        if (parentId != null) {
            parent = get(parentId);
            if (!parent.isRoot()) {
                throw new IllegalArgumentException("Project chi ho tro danh muc 2 cap.");
            }
            if (id != null && id.equals(parentId)) {
                throw new IllegalArgumentException("Danh muc khong the la cha cua chinh no.");
            }
        }

        boolean duplicate = parent == null
                ? categoryRepository.existsByNameIgnoreCaseAndParentIsNull(name)
                : categoryRepository.existsByNameIgnoreCaseAndParent_Id(name, parent.getId());

        if (duplicate && (id == null || !category.getName().equalsIgnoreCase(name)
                || !sameParent(category.getParent(), parent))) {
            throw new IllegalArgumentException("Ten danh muc da ton tai cung cap.");
        }

        if (id != null && category.isRoot() && parent != null && categoryRepository.existsByParent_Id(id)) {
            throw new IllegalArgumentException("Khong the doi danh muc dang co danh muc con thanh danh muc con.");
        }

        category.setName(name);
        category.setParent(parent);
        return categoryRepository.save(category);
    }

    @Transactional
    public void delete(Long id) {
        Category category = get(id);
        if (categoryRepository.existsByParent_Id(id)) {
            throw new IllegalArgumentException("Hay xoa cac danh muc con truoc.");
        }
        if (productRepository.existsByCategories_Id(id)) {
            throw new IllegalArgumentException("Danh muc dang duoc san pham su dung.");
        }
        categoryRepository.delete(category);
    }

    @Transactional(readOnly = true)
    public Category get(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Khong tim thay danh muc ID " + id));
    }

    private String normalizeName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Ten danh muc khong duoc de trong.");
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private boolean sameParent(Category first, Category second) {
        if (first == null || second == null) return first == second;
        return first.getId().equals(second.getId());
    }
}
