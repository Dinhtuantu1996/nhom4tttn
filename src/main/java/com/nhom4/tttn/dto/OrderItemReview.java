package com.nhom4.tttn.dto;

import java.util.List;

public record OrderItemReview(
        OrderLineView item,
        Integer availableQuantity,
        boolean stockSufficient,
        List<String> warnings
) {
    public boolean hasWarning() {
        return warnings != null && !warnings.isEmpty();
    }
}
