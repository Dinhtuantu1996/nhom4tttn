package com.nhom4.tttn.dto;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

public record OrderLineView(
        Long productId,
        Long productVariantId,
        String productName,
        String variantName,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal lineTotal,
        int stockDeductedQuantity
) {
    public String getUnitPriceText() {
        return formatMoney(unitPrice);
    }

    public String getLineTotalText() {
        return formatMoney(lineTotal);
    }

    private static String formatMoney(BigDecimal value) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
    }
}
