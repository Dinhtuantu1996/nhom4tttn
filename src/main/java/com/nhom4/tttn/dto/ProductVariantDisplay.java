package com.nhom4.tttn.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@AllArgsConstructor
public class ProductVariantDisplay {
    private final int variantType;
    private final List<Level> levels;
    private final List<Combination> combinations;

    public boolean isEnabled() {
        return variantType > 0 && !levels.isEmpty() && !combinations.isEmpty();
    }

    @Getter
    @AllArgsConstructor
    public static class Level {
        private final int level;
        private final Long parentId;
        private final String parentName;
        private final List<Value> values;
    }

    @Getter
    @AllArgsConstructor
    public static class Value {
        private final Long id;
        private final String name;
    }

    @Getter
    @AllArgsConstructor
    public static class Combination {
        private final Long id;
        private final List<Long> variantValueIds;
        private final BigDecimal price;
        private final int quantity;

        public String getValueIdsCsv() {
            return variantValueIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        }

        public String getPriceText() {
            BigDecimal safe = price == null ? BigDecimal.ZERO : price;
            return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
        }
    }
}
