package com.nhom4.tttn.enums;

public enum OrderStatus {
    PENDING("Chờ ADMIN duyệt"),
    COMPLETED("Đã hoàn thành"),
    CANCELLED("Đã hủy");

    private final String label;

    OrderStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED;
    }
}
