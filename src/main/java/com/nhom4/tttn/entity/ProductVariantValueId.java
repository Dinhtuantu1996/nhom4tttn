package com.nhom4.tttn.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Embeddable
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ProductVariantValueId implements Serializable {
    @Column(name = "product_variant_id")
    private Long productVariantId;

    @Column(name = "level", nullable = false)
    private Integer level;
}
