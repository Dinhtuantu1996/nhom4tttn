package com.nhom4.tttn.dto;

import java.util.List;

public record CartValidationRequest(
        List<CartItemRequest> items
) {
}
