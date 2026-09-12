package com.nhom4.tttn.entity;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Table(name = "product_variant_values", indexes = {
        @Index(name = "idx_product_variant_values_variant", columnList = "variant_value_id")
})
@Getter
public class ProductVariantValue {
    @EmbeddedId
    private ProductVariantValueId id;

    @MapsId("productVariantId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_variant_id", nullable = false)
    private ProductVariant productVariant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_value_id", nullable = false)
    private Variant variant;

    protected ProductVariantValue() {
    }

    public ProductVariantValue(ProductVariant productVariant, int level, Variant variant) {
        this.productVariant = productVariant;
        this.variant = variant;
        this.id = new ProductVariantValueId(productVariant.getId(), level);
    }
}
