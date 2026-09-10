package com.nhom4.tttn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "attributes")
@Getter
public class Attribute {
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    @Setter
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @Setter
    private Attribute parent;

    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    @OrderBy("name asc")
    private List<Attribute> children = new ArrayList<>();

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
    void preUpdate() {
        updatedDate = LocalDateTime.now();
    }

    public String getUpdatedDateText() {
        return updatedDate == null ? "" : updatedDate.format(DATE_TIME_FORMAT);
    }

    public boolean isRoot() {
        return parent == null;
    }
}
