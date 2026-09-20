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
                throw new IllegalArgumentException("Danh mục chỉ hỗ trợ tối đa 2 cấp.");
            }
            if (id != null && id.equals(parentId)) {
                throw new IllegalArgumentException("Danh mục không thể là cha của chính nó.");
            }
        }

        boolean duplicate = parent == null
                ? categoryRepository.existsByNameIgnoreCaseAndParentIsNull(name)
                : categoryRepository.existsByNameIgnoreCaseAndParent_Id(name, parent.getId());

        if (duplicate && (id == null || !category.getName().equalsIgnoreCase(name)
                || !sameParent(category.getParent(), parent))) {
            throw new IllegalArgumentException("Tên danh mục đã tồn tại cùng cấp.");
        }

        if (id != null && category.isRoot() && parent != null && categoryRepository.existsByParent_Id(id)) {
            throw new IllegalArgumentException("Không thể chuyển danh mục đang có danh mục con thành danh mục con.");
        }

        category.setName(name);
        category.setParent(parent);
        return categoryRepository.save(category);
    }

    @Transactional
    public void delete(Long id) {
        Category category = get(id);

        if (category.isRoot()) {
            if (categoryRepository.existsByParent_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa danh mục cha vì vẫn còn danh mục con.");
            }
            if (productRepository.existsByCategories_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa danh mục cha vì vẫn còn sản phẩm thuộc danh mục này.");
            }
        } else {
            if (categoryRepository.existsByParent_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa danh mục vì vẫn còn danh mục con.");
            }
            if (productRepository.existsByCategories_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa danh mục con vì vẫn còn sản phẩm thuộc danh mục này.");
            }
        }

        categoryRepository.delete(category);
        categoryRepository.flush();
    }

    @Transactional(readOnly = true)
    public Category get(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy danh mục ID " + id));
    }

    private String normalizeName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Tên danh mục không được để trống.");
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private boolean sameParent(Category first, Category second) {
        if (first == null || second == null) return first == second;
        return first.getId().equals(second.getId());
    }
}
