package com.nhom4.tttn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

@Entity
@Table(name = "order_items", indexes = {
        @Index(name = "idx_order_items_order", columnList = "order_id"),
        @Index(name = "idx_order_items_product", columnList = "product_id"),
        @Index(name = "idx_order_items_variant", columnList = "product_variant_id")
})
@Getter
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    @Setter
    private CustomerOrder order;

    // Snapshot keeps the invoice readable even if the catalog item is later deleted.
    // These two columns are intentionally scalar IDs instead of foreign keys.
    @Column(name = "product_id")
    @Setter
    private Long productId;

    @Column(name = "product_variant_id")
    @Setter
    private Long productVariantId;

    @Column(name = "product_name", nullable = false, length = 255)
    @Setter
    private String productName;

    @Column(name = "variant_name", columnDefinition = "TEXT")
    @Setter
    private String variantName;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 0)
    @Setter
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(nullable = false)
    @Setter
    private int quantity;

    @Column(name = "line_total", nullable = false, precision = 19, scale = 0)
    @Setter
    private BigDecimal lineTotal = BigDecimal.ZERO;

    @Column(name = "stock_deducted_quantity", nullable = false)
    @Setter
    private int stockDeductedQuantity = 0;

    public String getUnitPriceText() {
        return formatMoney(unitPrice);
    }

    public String getLineTotalText() {
        return formatMoney(lineTotal);
    }

    public boolean hasVariant() {
        return productVariantId != null;
    }

    private String formatMoney(BigDecimal value) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
    }
}
