package com.nhom4.tttn.service;

import com.nhom4.tttn.entity.Attribute;
import com.nhom4.tttn.repository.AttributeRepository;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AttributeService {
    private final AttributeRepository attributeRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<Attribute> roots() {
        return attributeRepository.findByParentIsNullOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public List<Attribute> all() {
        return attributeRepository.findAllByOrderByNameAsc();
    }

    @Transactional
    public Attribute save(Long id, String rawName, Long parentId) {
        String name = normalizeName(rawName);
        Attribute attribute = id == null ? new Attribute() : get(id);
        Attribute parent = null;

        if (parentId != null) {
            parent = get(parentId);
            if (!parent.isRoot()) {
                throw new IllegalArgumentException("Thuộc tính chỉ hỗ trợ tối đa 2 cấp.");
            }
            if (id != null && id.equals(parentId)) {
                throw new IllegalArgumentException("Thuộc tính không thể là cha của chính nó.");
            }
        }

        boolean duplicate = parent == null
                ? attributeRepository.existsByNameIgnoreCaseAndParentIsNull(name)
                : attributeRepository.existsByNameIgnoreCaseAndParent_Id(name, parent.getId());

        if (duplicate && (id == null || !attribute.getName().equalsIgnoreCase(name)
                || !sameParent(attribute.getParent(), parent))) {
            throw new IllegalArgumentException("Tên thuộc tính hoặc giá trị đã tồn tại cùng cấp.");
        }

        if (id != null && !sameParent(attribute.getParent(), parent)) {
            throw new IllegalArgumentException(
                    attribute.isRoot()
                            ? "Không thể chuyển nhóm thuộc tính thành một giá trị."
                            : "Không thể đổi nhóm của giá trị thuộc tính."
            );
        }

        attribute.setName(name);
        attribute.setParent(parent);
        return attributeRepository.save(attribute);
    }

    @Transactional
    public void delete(Long id) {
        Attribute attribute = get(id);

        if (attribute.isRoot()) {
            if (attributeRepository.existsByParent_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa nhóm thuộc tính vì vẫn còn giá trị bên trong.");
            }
            if (productRepository.existsByAttributes_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa nhóm thuộc tính vì đang được sản phẩm sử dụng.");
            }
        } else {
            if (attributeRepository.existsByParent_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa thuộc tính vì vẫn còn giá trị bên trong.");
            }
            if (productRepository.existsByAttributes_Id(id)) {
                throw new IllegalArgumentException("Không thể xóa giá trị thuộc tính vì đang có sản phẩm sử dụng.");
            }
        }

        attributeRepository.delete(attribute);
        attributeRepository.flush();
    }

    @Transactional(readOnly = true)
    public Attribute get(Long id) {
        return attributeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thuộc tính ID " + id));
    }

    private String normalizeName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Tên thuộc tính không được để trống.");
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private boolean sameParent(Attribute first, Attribute second) {
        if (first == null || second == null) return first == second;
        return first.getId().equals(second.getId());
    }
}
