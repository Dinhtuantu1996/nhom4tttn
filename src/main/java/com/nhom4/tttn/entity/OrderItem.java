package com.nhom4.tttn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(
        name = "order_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_order_items_order_product",
                columnNames = {"order_id", "product_id"}
        ),
        indexes = {
                @Index(name = "idx_order_items_order", columnList = "order_id"),
                @Index(name = "idx_order_items_product", columnList = "product_id")
        }
)
@Getter
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    @Setter
    private CustomerOrder order;

    // Used to compare the invoice quantity with the product's current stock.
    // Product deletion is blocked while any order item still references this ID.
    @Column(name = "product_id", nullable = false)
    @Setter
    private Long productId;

    // Snapshot fields keep old invoices unchanged when product name/price is edited later.
    @Column(name = "product_name", nullable = false, length = 255)
    @Setter
    private String productName;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 0)
    @Setter
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(nullable = false)
    @Setter
    private int quantity;
}
