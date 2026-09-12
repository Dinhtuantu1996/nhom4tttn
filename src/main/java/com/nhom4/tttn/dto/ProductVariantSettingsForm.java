package com.nhom4.tttn.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
public class ProductVariantSettingsForm {
    private int variantType;
    private BigDecimal price = BigDecimal.ZERO;
    private Integer quantity = 0;
    private List<Long> parentVariantIds = new ArrayList<>();
    private List<Row> rows = new ArrayList<>();

    @Getter
    @Setter
    public static class Row {
        private List<Long> variantValueIds = new ArrayList<>();
        private BigDecimal price = BigDecimal.ZERO;
        private Integer quantity = 0;

        public String getValueIdsCsv() {
            return variantValueIds == null ? "" : variantValueIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
        }
    }
}
