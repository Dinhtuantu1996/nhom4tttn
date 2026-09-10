package com.nhom4.tttn.entity;

import com.nhom4.tttn.enums.ProductAgeGroup;
import com.nhom4.tttn.enums.ProductGender;
import com.nhom4.tttn.dto.ProductImage;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Setter
    private ProductGender gender;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Setter
    private ProductAgeGroup ageGroup;

    @Column(nullable = false)
    @Setter
    private long viewCount = 0;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "product_categories",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    @OrderBy("name asc")
    @Setter
    private Set<Category> categories = new LinkedHashSet<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder asc, id asc")
    private List<ProductImage> images = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(nullable = false)
    private LocalDateTime updatedDate;

    @PrePersist
    void prePersist() {
        createdDate = LocalDateTime.now();
        updatedDate = createdDate;
    }

    @PreUpdate
    void preUpdate() { updatedDate = LocalDateTime.now(); }

    public String getUpdatedDateText() { return updatedDate == null ? "" : updatedDate.format(DATE_TIME_FORMAT); }
    public String getPrimaryImageUrl() {
        return images.isEmpty() ? null : images.getFirst().getUrl();
    }
}
