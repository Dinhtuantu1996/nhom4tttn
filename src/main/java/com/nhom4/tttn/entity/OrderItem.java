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
    @JoinColumn(
            name = "order_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_order_items_order")
    )
    @Setter
    private CustomerOrder order;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "product_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_order_items_product")
    )
    @Setter
    private Product product;
    @Column(name = "product_name", nullable = false, length = 255)
    @Setter
    private String productName;

    @Column(
            name = "unit_price",
            nullable = false,
            precision = 19,
            scale = 0,
            check = @CheckConstraint(
                    name = "chk_order_items_unit_price_non_negative",
                    constraint = "unit_price >= 0"
            )
    )
    @Setter
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(
            nullable = false,
            check = @CheckConstraint(
                    name = "chk_order_items_quantity_positive",
                    constraint = "quantity > 0"
            )
    )
    @Setter
    private int quantity;

    public Long getProductId() {
        return product == null ? null : product.getId();
    }
}
