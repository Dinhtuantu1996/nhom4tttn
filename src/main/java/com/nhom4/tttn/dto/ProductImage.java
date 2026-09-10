package com.nhom4.tttn.dto;

import com.nhom4.tttn.entity.Product;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "product_images")
@Getter
@Setter
public class ProductImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(nullable = false)
    private int displayOrder;

    public String getUrl() { return "/uploads/products/" + product.getId() + "/" + filename; }
}
