package com.nhom4.tttn.dto;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

public record CartItemView(
        Long productId,
        Long productVariantId,
        String productName,
        String variantName,
        String imageUrl,
        BigDecimal unitPrice,
        int quantity,
        int availableQuantity,
        BigDecimal lineTotal
) {
    public String unitPriceText() {
        return formatMoney(unitPrice);
    }

    public String lineTotalText() {
        return formatMoney(lineTotal);
    }

    private static String formatMoney(BigDecimal value) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
    }
}
