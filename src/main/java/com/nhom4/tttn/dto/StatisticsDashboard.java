package com.nhom4.tttn.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Getter
@AllArgsConstructor
public class StatisticsDashboard {
    private static final Locale VIETNAMESE = Locale.forLanguageTag("vi-VN");

    private final String rangeKey;
    private final LocalDate from;
    private final LocalDate to;
    private final String rangeLabel;
    private final String chartGranularity;
    private final Overview overview;
    private final List<RevenuePoint> revenuePoints;
    private final List<TopSellingProduct> topSellingProducts;
    private final List<TopViewedProduct> topViewedProducts;
    private final Inventory inventory;
    private final List<LowStockProduct> lowStockProducts;

    private static String formatVnd(BigDecimal value) {
        BigDecimal safeValue = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getIntegerInstance(VIETNAMESE).format(safeValue) + " đ";
    }

    private static String formatNumber(long value) {
        return NumberFormat.getIntegerInstance(VIETNAMESE).format(value);
    }

    public List<String> getRevenueLabels() {
        return revenuePoints.stream().map(RevenuePoint::getLabel).toList();
    }

    public List<BigDecimal> getRevenueValues() {
        return revenuePoints.stream().map(RevenuePoint::getRevenue).toList();
    }

    public List<Long> getRevenueOrderCounts() {
        return revenuePoints.stream().map(RevenuePoint::getOrderCount).toList();
    }

    @Getter
    @AllArgsConstructor
    public static class Overview {
        private final BigDecimal revenue;
        private final long totalOrders;
        private final long completedOrders;
        private final long pendingOrders;
        private final long cancelledOrders;
        private final long soldQuantity;

        public String getRevenueText() {
            return formatVnd(revenue);
        }

        public String getTotalOrdersText() {
            return formatNumber(totalOrders);
        }

        public String getCompletedOrdersText() {
            return formatNumber(completedOrders);
        }

        public String getPendingOrdersText() {
            return formatNumber(pendingOrders);
        }

        public String getCancelledOrdersText() {
            return formatNumber(cancelledOrders);
        }

        public String getSoldQuantityText() {
            return formatNumber(soldQuantity);
        }
    }

    @Getter
    @AllArgsConstructor
    public static class RevenuePoint {
        private final String key;
        private final String label;
        private final BigDecimal revenue;
        private final long orderCount;

        public String getRevenueText() {
            return formatVnd(revenue);
        }
    }

    @Getter
    @AllArgsConstructor
    public static class TopSellingProduct {
        private final Long productId;
        private final String productName;
        private final long soldQuantity;
        private final BigDecimal revenue;

        public String getRevenueText() {
            return formatVnd(revenue);
        }

        public String getSoldQuantityText() {
            return formatNumber(soldQuantity);
        }
    }

    @Getter
    @AllArgsConstructor
    public static class TopViewedProduct {
        private final Long productId;
        private final String productName;
        private final long viewCount;
        private final int quantity;

        public String getViewCountText() {
            return formatNumber(viewCount);
        }
    }

    @Getter
    @AllArgsConstructor
    public static class Inventory {
        private final long outOfStock;
        private final long lowStock;
        private final long inStock;

        public long getTotal() {
            return outOfStock + lowStock + inStock;
        }
    }

    @Getter
    @AllArgsConstructor
    public static class LowStockProduct {
        private final Long productId;
        private final String productName;
        private final int quantity;
        private final BigDecimal price;

        public String getPriceText() {
            return formatVnd(price);
        }
    }
}
