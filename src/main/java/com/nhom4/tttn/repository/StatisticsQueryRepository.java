package com.nhom4.tttn.repository;

import com.nhom4.tttn.dto.StatisticsDashboard;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class StatisticsQueryRepository {
    private final JdbcTemplate jdbcTemplate;

    public OrderCounts getOrderCounts(LocalDateTime start, LocalDateTime endExclusive) {
        String sql = """
                SELECT
                    COUNT(*) AS total_orders,
                    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_orders,
                    COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_orders,
                    COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_orders
                FROM orders
                WHERE created_date >= ? AND created_date < ?
                """;

        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new OrderCounts(
                rs.getLong("total_orders"),
                rs.getLong("completed_orders"),
                rs.getLong("pending_orders"),
                rs.getLong("cancelled_orders")
        ), Timestamp.valueOf(start), Timestamp.valueOf(endExclusive));
    }

    public BigDecimal getCompletedRevenue(LocalDateTime start, LocalDateTime endExclusive) {
        String sql = """
                SELECT COALESCE(SUM(total_amount), 0)
                FROM orders
                WHERE status = 'COMPLETED'
                  AND completed_date >= ?
                  AND completed_date < ?
                """;
        BigDecimal value = jdbcTemplate.queryForObject(
                sql,
                BigDecimal.class,
                Timestamp.valueOf(start),
                Timestamp.valueOf(endExclusive)
        );
        return value == null ? BigDecimal.ZERO : value;
    }

    public long getCompletedSoldQuantity(LocalDateTime start, LocalDateTime endExclusive) {
        String sql = """
                SELECT COALESCE(SUM(oi.quantity), 0)
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                WHERE o.status = 'COMPLETED'
                  AND o.completed_date >= ?
                  AND o.completed_date < ?
                """;
        Long value = jdbcTemplate.queryForObject(
                sql,
                Long.class,
                Timestamp.valueOf(start),
                Timestamp.valueOf(endExclusive)
        );
        return value == null ? 0L : value;
    }

    public Map<String, RevenueAggregate> getDailyRevenue(LocalDateTime start, LocalDateTime endExclusive) {
        String sql = """
                SELECT
                    DATE_FORMAT(completed_date, '%Y-%m-%d') AS period_key,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS order_count
                FROM orders
                WHERE status = 'COMPLETED'
                  AND completed_date >= ?
                  AND completed_date < ?
                GROUP BY DATE_FORMAT(completed_date, '%Y-%m-%d')
                ORDER BY period_key
                """;
        return revenueMap(sql, start, endExclusive);
    }

    public Map<String, RevenueAggregate> getMonthlyRevenue(LocalDateTime start, LocalDateTime endExclusive) {
        String sql = """
                SELECT
                    DATE_FORMAT(completed_date, '%Y-%m') AS period_key,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS order_count
                FROM orders
                WHERE status = 'COMPLETED'
                  AND completed_date >= ?
                  AND completed_date < ?
                GROUP BY DATE_FORMAT(completed_date, '%Y-%m')
                ORDER BY period_key
                """;
        return revenueMap(sql, start, endExclusive);
    }

    private Map<String, RevenueAggregate> revenueMap(String sql, LocalDateTime start, LocalDateTime endExclusive) {
        Map<String, RevenueAggregate> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                sql,
                rs -> {
                    result.put(
                            rs.getString("period_key"),
                            new RevenueAggregate(rs.getBigDecimal("revenue"), rs.getLong("order_count"))
                    );
                },
                Timestamp.valueOf(start),
                Timestamp.valueOf(endExclusive)
        );
        return result;
    }

    public List<StatisticsDashboard.TopSellingProduct> getTopSellingProducts(
            LocalDateTime start,
            LocalDateTime endExclusive,
            int limit
    ) {
        String sql = """
                SELECT
                    oi.product_id,
                    MAX(oi.product_name) AS product_name,
                    COALESCE(SUM(oi.quantity), 0) AS sold_quantity,
                    COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS revenue
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                WHERE o.status = 'COMPLETED'
                  AND o.completed_date >= ?
                  AND o.completed_date < ?
                GROUP BY oi.product_id
                ORDER BY sold_quantity DESC, revenue DESC, oi.product_id DESC
                LIMIT ?
                """;
        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new StatisticsDashboard.TopSellingProduct(
                        rs.getLong("product_id"),
                        rs.getString("product_name"),
                        rs.getLong("sold_quantity"),
                        rs.getBigDecimal("revenue")
                ),
                Timestamp.valueOf(start),
                Timestamp.valueOf(endExclusive),
                limit
        );
    }

    public List<StatisticsDashboard.TopViewedProduct> getTopViewedProducts(int limit) {
        String sql = """
                SELECT id, name, view_count, quantity
                FROM products
                ORDER BY view_count DESC, id DESC
                LIMIT ?
                """;
        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new StatisticsDashboard.TopViewedProduct(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getLong("view_count"),
                        rs.getInt("quantity")
                ),
                limit
        );
    }

    public StatisticsDashboard.Inventory getInventory() {
        String sql = """
                SELECT
                    COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock,
                    COALESCE(SUM(CASE WHEN quantity BETWEEN 1 AND 5 THEN 1 ELSE 0 END), 0) AS low_stock,
                    COALESCE(SUM(CASE WHEN quantity > 5 THEN 1 ELSE 0 END), 0) AS in_stock
                FROM products
                """;
        StatisticsDashboard.Inventory inventory = jdbcTemplate.queryForObject(
                sql,
                (rs, rowNum) -> new StatisticsDashboard.Inventory(
                        rs.getLong("out_of_stock"),
                        rs.getLong("low_stock"),
                        rs.getLong("in_stock")
                )
        );
        return inventory == null ? new StatisticsDashboard.Inventory(0, 0, 0) : inventory;
    }

    public List<StatisticsDashboard.LowStockProduct> getLowStockProducts(int threshold, int limit) {
        String sql = """
                SELECT id, name, quantity, price
                FROM products
                WHERE quantity <= ?
                ORDER BY quantity ASC, updated_date DESC, id DESC
                LIMIT ?
                """;
        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new StatisticsDashboard.LowStockProduct(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getInt("quantity"),
                        rs.getBigDecimal("price")
                ),
                threshold,
                limit
        );
    }

    public record OrderCounts(long total, long completed, long pending, long cancelled) {
    }

    public record RevenueAggregate(BigDecimal revenue, long orderCount) {
    }
}
