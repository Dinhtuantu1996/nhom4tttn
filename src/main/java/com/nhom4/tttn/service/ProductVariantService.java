package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.ProductVariantDisplay;
import com.nhom4.tttn.dto.ProductVariantSettingsForm;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.entity.ProductVariant;
import com.nhom4.tttn.entity.ProductVariantValue;
import com.nhom4.tttn.entity.Variant;
import com.nhom4.tttn.repository.ProductRepository;
import com.nhom4.tttn.repository.ProductVariantRepository;
import com.nhom4.tttn.repository.ProductVariantValueRepository;
import com.nhom4.tttn.repository.VariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProductVariantService {
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductVariantValueRepository productVariantValueRepository;
    private final VariantRepository variantRepository;

    @Transactional(readOnly = true)
    public ProductVariantSettingsForm getSettings(Long productId) {
        Product product = getProduct(productId);
        ProductVariantSettingsForm form = new ProductVariantSettingsForm();
        form.setVariantType(product.getVariantType());
        form.setPrice(product.getPrice());
        form.setQuantity(product.getQuantity());

        if (product.getVariantType() == 0) {
            return form;
        }

        List<ProductVariant> rows = productVariantRepository.findAllByProduct_IdOrderByIdAsc(productId);
        List<ProductVariantValue> links = productVariantValueRepository.findAllByProductIdWithVariant(productId);
        Map<Long, List<ProductVariantValue>> linksByRow = groupLinks(links);

        Map<Integer, Long> parentByLevel = new LinkedHashMap<>();
        for (ProductVariantValue link : links) {
            Variant parent = link.getVariant().getParent();
            if (parent != null) {
                parentByLevel.putIfAbsent(link.getId().getLevel(), parent.getId());
            }
        }
        for (int level = 1; level <= product.getVariantType(); level++) {
            Long parentId = parentByLevel.get(level);
            if (parentId != null) form.getParentVariantIds().add(parentId);
        }

        for (ProductVariant row : rows) {
            ProductVariantSettingsForm.Row item = new ProductVariantSettingsForm.Row();
            List<Long> valueIds = linksByRow.getOrDefault(row.getId(), List.of()).stream()
                    .sorted((left, right) -> Integer.compare(left.getId().getLevel(), right.getId().getLevel()))
                    .map(link -> link.getVariant().getId())
                    .toList();
            item.setVariantValueIds(new ArrayList<>(valueIds));
            item.setPrice(row.getPrice());
            item.setQuantity(row.getQuantity());
            form.getRows().add(item);
        }
        return form;
    }

    @Transactional
    public void saveSettings(Long productId, ProductVariantSettingsForm form) {
        Product product = getProduct(productId);
        int type = form == null ? 0 : form.getVariantType();
        if (type < 0 || type > 2) {
            throw new IllegalArgumentException("Loại biến thể không hợp lệ.");
        }

        if (type == 0) {
            deleteByProductId(productId);
            product.setVariantType(0);
            product.setPrice(nonNegativePrice(form.getPrice(), "Giá tiền"));
            product.setQuantity(nonNegativeQuantity(form.getQuantity(), "Số lượng"));
            productRepository.save(product);
            return;
        }

        List<Long> parentIds = distinctPositiveIds(form.getParentVariantIds());
        if (parentIds.size() != type) {
            throw new IllegalArgumentException(type == 1
                    ? "Hãy chọn biến thể cấp 1."
                    : "Hãy chọn đủ hai biến thể cấp 1 và cấp 2.");
        }
        if (type == 2 && parentIds.get(0).equals(parentIds.get(1))) {
            throw new IllegalArgumentException("Hai cấp biến thể phải là hai nhóm khác nhau.");
        }

        List<Variant> parents = variantRepository.findAllById(parentIds);
        if (parents.size() != parentIds.size() || parents.stream().anyMatch(variant -> !variant.isRoot())) {
            throw new IllegalArgumentException("Nhóm biến thể đã chọn không hợp lệ.");
        }
        Map<Long, Variant> parentById = new HashMap<>();
        parents.forEach(parent -> parentById.put(parent.getId(), parent));

        List<ProductVariantSettingsForm.Row> submittedRows = form.getRows() == null ? List.of() : form.getRows();
        if (submittedRows.isEmpty()) {
            throw new IllegalArgumentException("Hãy chọn ít nhất một giá trị biến thể để lưu.");
        }

        Set<String> seenKeys = new LinkedHashSet<>();
        List<ValidatedRow> validatedRows = new ArrayList<>();
        for (ProductVariantSettingsForm.Row row : submittedRows) {
            List<Long> valueIds = distinctPositiveIds(row.getVariantValueIds());
            if (valueIds.size() != type) {
                throw new IllegalArgumentException("Tổ hợp biến thể không hợp lệ.");
            }

            List<Variant> values = variantRepository.findAllById(valueIds);
            if (values.size() != valueIds.size() || values.stream().anyMatch(Variant::isRoot)) {
                throw new IllegalArgumentException("Có giá trị biến thể không tồn tại.");
            }
            Map<Long, Variant> valueById = new HashMap<>();
            values.forEach(value -> valueById.put(value.getId(), value));

            for (int index = 0; index < type; index++) {
                Variant value = valueById.get(valueIds.get(index));
                Long expectedParentId = parentIds.get(index);
                if (value == null || value.getParent() == null
                        || !expectedParentId.equals(value.getParent().getId())) {
                    throw new IllegalArgumentException("Giá trị biến thể không thuộc đúng nhóm đã chọn.");
                }
            }

            String key = String.join(":", valueIds.stream().map(String::valueOf).toList());
            if (!seenKeys.add(key)) {
                throw new IllegalArgumentException("Tổ hợp biến thể bị trùng.");
            }

            validatedRows.add(new ValidatedRow(
                    valueIds,
                    valueById,
                    nonNegativePrice(row.getPrice(), "Giá biến thể"),
                    nonNegativeQuantity(row.getQuantity(), "Số lượng biến thể")
            ));
        }

        deleteByProductId(productId);
        product.setVariantType(type);
        product.setPrice(BigDecimal.ZERO);
        product.setQuantity(0);
        productRepository.saveAndFlush(product);

        List<ProductVariant> entities = new ArrayList<>();
        for (ValidatedRow row : validatedRows) {
            ProductVariant entity = new ProductVariant();
            entity.setProduct(product);
            entity.setPrice(row.price());
            entity.setQuantity(row.quantity());
            entities.add(entity);
        }
        entities = productVariantRepository.saveAllAndFlush(entities);

        List<ProductVariantValue> links = new ArrayList<>();
        for (int rowIndex = 0; rowIndex < entities.size(); rowIndex++) {
            ProductVariant entity = entities.get(rowIndex);
            ValidatedRow row = validatedRows.get(rowIndex);
            for (int levelIndex = 0; levelIndex < type; levelIndex++) {
                Long valueId = row.valueIds().get(levelIndex);
                links.add(new ProductVariantValue(entity, levelIndex + 1, row.valueById().get(valueId)));
            }
        }
        productVariantValueRepository.saveAll(links);
    }

    @Transactional(readOnly = true)
    public ProductVariantDisplay getDisplay(Long productId) {
        Product product = getProduct(productId);
        if (product.getVariantType() == 0) {
            return new ProductVariantDisplay(0, List.of(), List.of());
        }

        List<ProductVariant> rows = productVariantRepository.findAllByProduct_IdOrderByIdAsc(productId);
        List<ProductVariantValue> links = productVariantValueRepository.findAllByProductIdWithVariant(productId);
        Map<Long, List<ProductVariantValue>> linksByRow = groupLinks(links);
        Map<Integer, Variant> parentByLevel = new LinkedHashMap<>();

        for (ProductVariantValue link : links) {
            if (link.getVariant().getParent() != null) {
                parentByLevel.putIfAbsent(link.getId().getLevel(), link.getVariant().getParent());
            }
        }

        List<ProductVariantDisplay.Level> levels = new ArrayList<>();
        for (int level = 1; level <= product.getVariantType(); level++) {
            Variant parent = parentByLevel.get(level);
            if (parent == null) continue;
            List<ProductVariantDisplay.Value> values = variantRepository.findByParent_IdOrderByNameAsc(parent.getId()).stream()
                    .map(value -> new ProductVariantDisplay.Value(value.getId(), value.getName()))
                    .toList();
            levels.add(new ProductVariantDisplay.Level(level, parent.getId(), parent.getName(), values));
        }

        List<ProductVariantDisplay.Combination> combinations = rows.stream().map(row -> {
            List<Long> valueIds = linksByRow.getOrDefault(row.getId(), List.of()).stream()
                    .sorted((left, right) -> Integer.compare(left.getId().getLevel(), right.getId().getLevel()))
                    .map(link -> link.getVariant().getId())
                    .toList();
            return new ProductVariantDisplay.Combination(
                    row.getId(), valueIds, row.getPrice(), row.getQuantity()
            );
        }).filter(item -> item.getVariantValueIds().size() == product.getVariantType()).toList();

        return new ProductVariantDisplay(product.getVariantType(), levels, combinations);
    }

    @Transactional
    public void deleteByProductId(Long productId) {
        productVariantValueRepository.deleteAllByProductId(productId);
        productVariantRepository.deleteAllByProduct_Id(productId);
        productVariantRepository.flush();
    }

    @Transactional(readOnly = true)
    public Map<Long, BigDecimal> minimumAvailablePrices(Collection<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) return Map.of();
        Map<Long, BigDecimal> prices = new HashMap<>();
        for (ProductVariantRepository.MinimumPriceRow row : productVariantRepository.findMinimumAvailablePrices(productIds)) {
            prices.put(row.getProductId(), row.getMinimumPrice());
        }
        return prices;
    }

    @Transactional(readOnly = true)
    public BigDecimal minimumAvailablePrice(Long productId) {
        return productVariantRepository.findMinimumAvailablePrice(productId);
    }

    private Product getProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm ID " + productId));
    }

    private Map<Long, List<ProductVariantValue>> groupLinks(List<ProductVariantValue> links) {
        Map<Long, List<ProductVariantValue>> grouped = new LinkedHashMap<>();
        for (ProductVariantValue link : links) {
            grouped.computeIfAbsent(link.getProductVariant().getId(), ignored -> new ArrayList<>()).add(link);
        }
        return grouped;
    }

    private List<Long> distinctPositiveIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        LinkedHashSet<Long> unique = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) unique.add(id);
        }
        return List.copyOf(unique);
    }

    private BigDecimal nonNegativePrice(BigDecimal value, String label) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        if (safe.signum() < 0 || safe.scale() > 0) {
            throw new IllegalArgumentException(label + " phải là số nguyên từ 0 trở lên.");
        }
        return safe;
    }

    private int nonNegativeQuantity(Integer value, String label) {
        int safe = value == null ? 0 : value;
        if (safe < 0) {
            throw new IllegalArgumentException(label + " phải từ 0 trở lên.");
        }
        return safe;
    }

    private record ValidatedRow(
            List<Long> valueIds,
            Map<Long, Variant> valueById,
            BigDecimal price,
            int quantity
    ) {
    }
}
