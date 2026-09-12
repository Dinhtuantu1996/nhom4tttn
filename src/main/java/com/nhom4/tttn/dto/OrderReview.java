package com.nhom4.tttn.dto;

import java.util.List;

public record OrderReview(
        OrderDetailView order,
        List<OrderItemReview> items
) {
    public boolean hasWarnings() {
        return items != null && items.stream().anyMatch(OrderItemReview::hasWarning);
    }
}
