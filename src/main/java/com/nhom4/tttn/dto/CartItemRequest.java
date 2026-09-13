package com.nhom4.tttn.dto;

public record CartItemRequest(
        Long productId,
        int quantity
) {
}
