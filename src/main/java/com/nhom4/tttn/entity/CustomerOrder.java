package com.nhom4.tttn.entity;

import com.nhom4.tttn.enums.OrderStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_orders_customer_email", columnList = "customer_email"),
        @Index(name = "idx_orders_status_created", columnList = "status,created_date")
})
@Getter
public class CustomerOrder {
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    @Setter
    private String code;

    @Column(name = "user_id")
    @Setter
    private Long userId;

    @Column(name = "customer_name", nullable = false, length = 120)
    @Setter
    private String customerName;

    @Column(name = "customer_email", nullable = false, length = 180)
    @Setter
    private String customerEmail;

    @Column(nullable = false, length = 30)
    @Setter
    private String phone;

    @Column(nullable = false, columnDefinition = "TEXT")
    @Setter
    private String address;

    @Column(columnDefinition = "TEXT")
    @Setter
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Setter
    private OrderStatus status = OrderStatus.PENDING;

    @Column(name = "total_amount", nullable = false, precision = 19, scale = 0)
    @Setter
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    private List<OrderItem> items = new ArrayList<>();

    @Column(name = "created_date", nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(name = "updated_date", nullable = false)
    private LocalDateTime updatedDate;

    @Column(name = "completed_date")
    @Setter
    private LocalDateTime completedDate;

    @Column(name = "cancelled_date")
    @Setter
    private LocalDateTime cancelledDate;

    @PrePersist
    void prePersist() {
        if (status == null) status = OrderStatus.PENDING;
        if (totalAmount == null) totalAmount = BigDecimal.ZERO;
        createdDate = LocalDateTime.now();
        updatedDate = createdDate;
    }

    @PreUpdate
    void preUpdate() {
        updatedDate = LocalDateTime.now();
    }

    public void addItem(OrderItem item) {
        item.setOrder(this);
        items.add(item);
    }

    public String getCreatedDateText() {
        return createdDate == null ? "" : createdDate.format(DATE_TIME_FORMAT);
    }

    public String getUpdatedDateText() {
        return updatedDate == null ? "" : updatedDate.format(DATE_TIME_FORMAT);
    }

    public String getTotalAmountText() {
        return formatMoney(totalAmount);
    }

    private String formatMoney(BigDecimal value) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(safe) + " VNĐ";
    }
}
