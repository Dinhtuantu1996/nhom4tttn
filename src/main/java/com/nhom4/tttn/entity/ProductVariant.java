package com.nhom4.tttn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "product_variants", indexes = {
        @Index(name = "idx_product_variants_product", columnList = "product_id"),
        @Index(name = "idx_product_variants_stock_price", columnList = "product_id,quantity,price")
})
@Getter
public class ProductVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    @Setter
    private Product product;

    @Column(nullable = false, precision = 19, scale = 0)
    @Setter
    private BigDecimal price = BigDecimal.ZERO;

    @Column(nullable = false)
    @Setter
    private int quantity = 0;

    @OneToMany(mappedBy = "productVariant", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProductVariantValue> values = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(nullable = false)
    private LocalDateTime updatedDate;

    @PrePersist
    void prePersist() {
        if (price == null) price = BigDecimal.ZERO;
        if (quantity < 0) quantity = 0;
        createdDate = LocalDateTime.now();
        updatedDate = createdDate;
    }

    @PreUpdate
    void preUpdate() {
        updatedDate = LocalDateTime.now();
    }
}
