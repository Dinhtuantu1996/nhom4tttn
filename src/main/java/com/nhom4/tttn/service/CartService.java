package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.CartItemRequest;
import com.nhom4.tttn.dto.CartItemView;
import com.nhom4.tttn.dto.CartValidationResponse;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {
    public static final int MAX_DISTINCT_ITEMS = 10;

    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public CartValidationResponse validate(List<CartItemRequest> requestedItems) {
        List<CartItemRequest> source = requestedItems == null ? List.of() : requestedItems;
        List<String> messages = new ArrayList<>();
        boolean changed = false;

        LinkedHashMap<Long, Integer> requestedByProduct = new LinkedHashMap<>();
        boolean itemLimitExceeded = false;
        for (CartItemRequest item : source) {
            if (item == null || item.productId() == null || item.productId() <= 0 || item.quantity() <= 0) {
                changed = true;
                continue;
            }

            Integer previous = requestedByProduct.get(item.productId());
            if (previous != null) {
                long merged = (long) previous + item.quantity();
                requestedByProduct.put(item.productId(), (int) Math.min(merged, Integer.MAX_VALUE));
                changed = true;
                continue;
            }

            if (requestedByProduct.size() >= MAX_DISTINCT_ITEMS) {
                itemLimitExceeded = true;
                changed = true;
                continue;
            }
            requestedByProduct.put(item.productId(), item.quantity());
        }

        if (itemLimitExceeded) {
            messages.add("Mỗi đơn hàng chỉ được tối đa " + MAX_DISTINCT_ITEMS
                    + " mặt hàng khác nhau. Các sản phẩm vượt giới hạn đã được bỏ khỏi giỏ.");
        }

        if (requestedByProduct.isEmpty()) {
            return new CartValidationResponse(
                    List.of(),
                    messages,
                    BigDecimal.ZERO,
                    changed || !source.isEmpty(),
                    false
            );
        }

        Set<Long> productIds = new LinkedHashSet<>(requestedByProduct.keySet());
        Map<Long, Product> products = productRepository.findAllByIdIn(productIds).stream()
                .collect(Collectors.toMap(Product::getId, product -> product, (left, right) -> left));

        List<CartItemView> normalizedItems = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        boolean checkoutAllowed = true;

        for (Map.Entry<Long, Integer> entry : requestedByProduct.entrySet()) {
            Long productId = entry.getKey();
            int requestedQuantity = entry.getValue();
            Product product = products.get(productId);

            if (product == null) {
                changed = true;
                messages.add("Đã bỏ một sản phẩm khỏi giỏ vì sản phẩm không còn tồn tại.");
                continue;
            }

            int available = Math.max(product.getQuantity(), 0);
            if (available <= 0) {
                changed = true;
                messages.add("Đã bỏ \"" + product.getName() + "\" khỏi giỏ vì hiện đã hết hàng.");
                continue;
            }

            if (requestedQuantity > available) {
                checkoutAllowed = false;
            }

            BigDecimal unitPrice = product.getPrice();
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(requestedQuantity));

            normalizedItems.add(new CartItemView(
                    product.getId(),
                    product.getName(),
                    product.getPrimaryImageUrl(),
                    unitPrice,
                    requestedQuantity,
                    available,
                    lineTotal
            ));
            total = total.add(lineTotal);
        }

        if (normalizedItems.size() != requestedByProduct.size()) {
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
}
