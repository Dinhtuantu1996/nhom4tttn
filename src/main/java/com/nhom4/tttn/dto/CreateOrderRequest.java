package com.nhom4.tttn.dto;

import java.util.List;

public record CreateOrderRequest(
        String customerName,
        String customerEmail,
        String phone,
        String address,
        String note,
        List<CartItemRequest> items
) {
}
