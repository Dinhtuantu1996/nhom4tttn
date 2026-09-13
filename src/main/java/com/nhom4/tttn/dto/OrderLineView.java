package com.nhom4.tttn.dto;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

public record OrderLineView(
        Long productId,
        String productName,
        BigDecimal unitPrice,
        int quantity
) {
    public BigDecimal getLineTotal() {
        BigDecimal safePrice = unitPrice == null ? BigDecimal.ZERO : unitPrice;
        return safePrice.multiply(BigDecimal.valueOf(Math.max(quantity, 0)));
    }

    public String getUnitPriceText() {
        return formatMoney(unitPrice);
    }

    public String getLineTotalText() {
        return formatMoney(getLineTotal());
    }

    private static String formatMoney(BigDecimal value) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
    }
}
