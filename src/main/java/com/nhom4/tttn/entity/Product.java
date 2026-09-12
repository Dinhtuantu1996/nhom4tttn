package com.nhom4.tttn.entity;

import com.nhom4.tttn.dto.ProductImage;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "products")
@Getter
public class Product {
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    @Setter
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    @Setter
    private String description;

    @Column(nullable = false)
    @Setter
    private long viewCount = 0;

    @Column(nullable = false, precision = 19, scale = 0)
    @Setter
    private BigDecimal price = BigDecimal.ZERO;

    @Column(nullable = false)
    @Setter
    private int quantity = 0;

    @Column(nullable = false, columnDefinition = "INT DEFAULT 0")
    @Setter
    private int variantType = 0;

    @Transient
    @Setter
    private BigDecimal displayPrice;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "product_categories",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    @OrderBy("name asc")
    @Setter
    private Set<Category> categories = new LinkedHashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "product_attributes",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "attribute_id")
    )
    @OrderBy("name asc")
    @Setter
    private Set<Attribute> attributes = new LinkedHashSet<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder asc, id asc")
    private List<ProductImage> images = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(nullable = false)
    private LocalDateTime updatedDate;

    @PrePersist
    void prePersist() {
        if (price == null) price = BigDecimal.ZERO;
        if (quantity < 0) quantity = 0;
        if (variantType < 0 || variantType > 2) variantType = 0;
        createdDate = LocalDateTime.now();
        updatedDate = createdDate;
    }

    @PreUpdate
    void preUpdate() {
        updatedDate = LocalDateTime.now();
    }

    public String getUpdatedDateText() {
        return updatedDate == null ? "" : updatedDate.format(DATE_TIME_FORMAT);
    }

    public String getPrimaryImageUrl() {
        return images.isEmpty() ? null : images.getFirst().getUrl();
    }

    public String getPriceText() {
        return formatPrice(price);
    }

    public boolean isDisplayPriceAvailable() {
        return variantType == 0 ? quantity > 0 : displayPrice != null;
    }

    public String getDisplayPriceText() {
        BigDecimal value = variantType == 0 ? price : displayPrice;
        return formatPrice(value);
    }

    private String formatPrice(BigDecimal value) {
        BigDecimal safePrice = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safePrice) + " VNĐ";
    }
}
