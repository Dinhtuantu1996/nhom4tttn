package com.nhom4.tttn.dto;

public record CartItemRequest(
        Long productId,
        Long productVariantId,
        int quantity
) {
}
