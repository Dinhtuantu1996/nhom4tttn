package com.nhom4.tttn.dto;

import com.nhom4.tttn.enums.OrderStatus;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public record OrderSummaryView(
        Long id,
        String code,
        String customerName,
        String customerEmail,
        String phone,
        OrderStatus status,
        BigDecimal totalAmount,
        LocalDateTime createdDate
) {
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public String getCreatedDateText() {
        return createdDate == null ? "" : createdDate.format(DATE_TIME_FORMAT);
    }

    public String getTotalAmountText() {
        BigDecimal safe = totalAmount == null ? BigDecimal.ZERO : totalAmount;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
    }
}
