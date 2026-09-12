package com.nhom4.tttn.dto;

import java.math.BigDecimal;
import java.util.List;

public record CartValidationResponse(
        List<CartItemView> items,
        List<String> messages,
        BigDecimal totalAmount,
        boolean changed,
        boolean checkoutAllowed
) {
}
