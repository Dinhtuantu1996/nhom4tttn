package com.nhom4.tttn.service;

import com.nhom4.tttn.entity.Variant;
import com.nhom4.tttn.repository.ProductVariantValueRepository;
import com.nhom4.tttn.repository.VariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VariantService {
    private final VariantRepository variantRepository;
    private final ProductVariantValueRepository productVariantValueRepository;

    @Transactional(readOnly = true)
    public List<Variant> roots() {
        return variantRepository.findByParentIsNullOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public Variant get(Long id) {
        return variantRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy biến thể ID " + id));
    }

    @Transactional
    public Variant save(Long id, String rawName, Long parentId) {
        String name = normalizeName(rawName);
        Variant variant = id == null ? new Variant() : get(id);
        Variant parent = null;

        if (parentId != null) {
            parent = get(parentId);
            if (!parent.isRoot()) {
                throw new IllegalArgumentException("Biến thể chỉ hỗ trợ tối đa 2 cấp.");
            }
            if (id != null && id.equals(parentId)) {
                throw new IllegalArgumentException("Biến thể không thể là cha của chính nó.");
            }
        }

        boolean duplicate = parent == null
                ? variantRepository.existsByNameIgnoreCaseAndParentIsNull(name)
                : variantRepository.existsByNameIgnoreCaseAndParent_Id(name, parent.getId());

        if (duplicate && (id == null || !variant.getName().equalsIgnoreCase(name)
                || !sameParent(variant.getParent(), parent))) {
            throw new IllegalArgumentException("Tên biến thể/giá trị đã tồn tại cùng cấp.");
        }

        if (id != null && !sameParent(variant.getParent(), parent)) {
            throw new IllegalArgumentException(
                    variant.isRoot()
                            ? "Không thể đổi biến thể lớn thành giá trị con."
                            : "Không thể đổi nhóm cha của giá trị biến thể."
            );
        }

        variant.setName(name);
        variant.setParent(parent);
        return variantRepository.save(variant);
    }

    @Transactional
    public void delete(Long id) {
        Variant variant = get(id);
        if (variantRepository.existsByParent_Id(id)) {
            throw new IllegalArgumentException("Không thể xóa biến thể lớn vì vẫn còn giá trị con.");
        }
        if (productVariantValueRepository.existsByVariant_Id(id)) {
            throw new IllegalArgumentException("Không thể xóa giá trị vì đang có sản phẩm sử dụng biến thể này.");
        }
        variantRepository.delete(variant);
        variantRepository.flush();
    }

    private String normalizeName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Tên biến thể không được để trống.");
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private boolean sameParent(Variant first, Variant second) {
        if (first == null || second == null) return first == second;
        return first.getId().equals(second.getId());
    }
}
