package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.CartItemRequest;
import com.nhom4.tttn.dto.CartItemView;
import com.nhom4.tttn.dto.CartValidationResponse;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.entity.ProductVariant;
import com.nhom4.tttn.entity.ProductVariantValue;
import com.nhom4.tttn.repository.ProductRepository;
import com.nhom4.tttn.repository.ProductVariantRepository;
import com.nhom4.tttn.repository.ProductVariantValueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductVariantValueRepository productVariantValueRepository;

    @Transactional(readOnly = true)
    public CartValidationResponse validate(List<CartItemRequest> requestedItems) {
        List<CartItemRequest> source = requestedItems == null ? List.of() : requestedItems;
        List<String> messages = new ArrayList<>();
        boolean changed = false;

        LinkedHashMap<CartKey, Integer> requestedByKey = new LinkedHashMap<>();
        for (CartItemRequest item : source) {
            if (item == null || item.productId() == null || item.productId() <= 0 || item.quantity() <= 0) {
                changed = true;
                continue;
            }
            CartKey key = new CartKey(item.productId(), positiveOrNull(item.productVariantId()));
            Integer previous = requestedByKey.putIfAbsent(key, item.quantity());
            if (previous != null) {
                long merged = (long) previous + item.quantity();
                requestedByKey.put(key, (int) Math.min(merged, Integer.MAX_VALUE));
                changed = true;
            }
        }

        if (requestedByKey.isEmpty()) {
            return new CartValidationResponse(
                    List.of(),
                    messages,
                    BigDecimal.ZERO,
                    changed || !source.isEmpty(),
                    false
            );
        }

        Set<Long> productIds = requestedByKey.keySet().stream()
                .map(CartKey::productId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Product> products = productRepository.findAllByIdIn(productIds).stream()
                .collect(Collectors.toMap(Product::getId, product -> product, (left, right) -> left));

        Set<Long> variantIds = requestedByKey.keySet().stream()
                .map(CartKey::productVariantId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, ProductVariant> variants = variantIds.isEmpty()
                ? Map.of()
                : productVariantRepository.findAllByIdsWithProduct(variantIds).stream()
                .collect(Collectors.toMap(ProductVariant::getId, variant -> variant));
        Map<Long, String> variantNames = buildVariantNames(variantIds);

        List<CartItemView> normalizedItems = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        boolean checkoutAllowed = true;

        for (Map.Entry<CartKey, Integer> entry : requestedByKey.entrySet()) {
            CartKey key = entry.getKey();
            int requestedQuantity = entry.getValue();
            Product product = products.get(key.productId());

            if (product == null) {
                changed = true;
                messages.add("Đã bỏ một sản phẩm khỏi giỏ vì sản phẩm không còn tồn tại.");
                continue;
            }

            ProductVariant variant = null;
            if (product.getVariantType() == 0) {
                if (key.productVariantId() != null) {
                    changed = true;
                    messages.add("Đã bỏ \"" + product.getName() + "\" vì cấu hình biến thể của sản phẩm đã thay đổi.");
                    continue;
                }
            } else {
                if (key.productVariantId() == null) {
                    changed = true;
                    messages.add("Đã bỏ \"" + product.getName() + "\" vì biến thể đã chọn không còn hợp lệ.");
                    continue;
                }
                variant = variants.get(key.productVariantId());
                if (variant == null || variant.getProduct() == null
                        || !product.getId().equals(variant.getProduct().getId())) {
                    changed = true;
                    messages.add("Đã bỏ \"" + product.getName() + "\" vì biến thể đã chọn không còn tồn tại.");
                    continue;
                }
            }

            int available = variant == null ? product.getQuantity() : variant.getQuantity();
            if (available <= 0) {
                changed = true;
                messages.add("Đã bỏ \"" + product.getName() + "\" khỏi giỏ vì hiện đã hết hàng.");
                continue;
            }

            if (requestedQuantity > available) {
                checkoutAllowed = false;
            }

            BigDecimal unitPrice = variant == null ? product.getPrice() : variant.getPrice();
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(requestedQuantity));
            String variantName = variant == null ? null : variantNames.getOrDefault(variant.getId(), "Biến thể đã chọn");
            String imageUrl = product.getPrimaryImageUrl();

            normalizedItems.add(new CartItemView(
                    product.getId(),
                    variant == null ? null : variant.getId(),
                    product.getName(),
                    variantName,
                    imageUrl,
                    unitPrice,
                    requestedQuantity,
                    available,
                    lineTotal
            ));
            total = total.add(lineTotal);
        }

        if (normalizedItems.size() != requestedByKey.size()) {
            changed = true;
        }

        return new CartValidationResponse(
                List.copyOf(normalizedItems),
                List.copyOf(messages),
                total,
                changed,
                !normalizedItems.isEmpty() && checkoutAllowed
        );
    }

    private Map<Long, String> buildVariantNames(Collection<Long> productVariantIds) {
        if (productVariantIds == null || productVariantIds.isEmpty()) return Map.of();
        List<ProductVariantValue> links = productVariantValueRepository.findAllByProductVariantIdsWithVariant(productVariantIds);
        Map<Long, List<String>> parts = new LinkedHashMap<>();
        for (ProductVariantValue link : links) {
            String valueName = link.getVariant().getName();
            String parentName = link.getVariant().getParent() == null ? null : link.getVariant().getParent().getName();
            String label = parentName == null || parentName.isBlank()
                    ? valueName
                    : parentName + ": " + valueName;
            parts.computeIfAbsent(link.getProductVariant().getId(), ignored -> new ArrayList<>()).add(label);
        }
        Map<Long, String> names = new LinkedHashMap<>();
        parts.forEach((id, values) -> names.put(id, String.join(" / ", values)));
        return names;
    }

    private Long positiveOrNull(Long value) {
        return value != null && value > 0 ? value : null;
    }

    private record CartKey(Long productId, Long productVariantId) {
    }
}
