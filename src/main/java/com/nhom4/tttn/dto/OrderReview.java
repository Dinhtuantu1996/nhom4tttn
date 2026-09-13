package com.nhom4.tttn.dto;

import com.nhom4.tttn.enums.OrderStatus;

import java.util.List;

public record OrderReview(
        OrderDetailView order,
        List<OrderItemReview> items
) {
    public boolean hasWarnings() {
        return items != null && items.stream().anyMatch(OrderItemReview::hasWarning);
    }

    public boolean canComplete() {
        return order != null
                && order.status() == OrderStatus.PENDING
                && items != null
                && !items.isEmpty()
                && items.stream().allMatch(OrderItemReview::stockSufficient);
    }
}
