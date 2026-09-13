package com.nhom4.tttn.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductSqlDeleteService {
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void deleteProductData(Long productId) {
        Integer orderItemCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM order_items WHERE product_id = ?",
                Integer.class,
                productId
        );
        if (orderItemCount != null && orderItemCount > 0) {
            throw new IllegalStateException(
                    "Không thể xóa sản phẩm vì sản phẩm đã xuất hiện trong hóa đơn. "
                            + "Bạn có thể cập nhật sản phẩm hoặc đưa số lượng về 0 nếu không muốn tiếp tục bán."
            );
        }

        jdbcTemplate.update("DELETE FROM product_images WHERE product_id = ?", productId);
        jdbcTemplate.update("DELETE FROM product_attributes WHERE product_id = ?", productId);
        jdbcTemplate.update("DELETE FROM product_categories WHERE product_id = ?", productId);

        int deleted;
        try {
            deleted = jdbcTemplate.update("DELETE FROM products WHERE id = ?", productId);
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalStateException(
                    "Không thể xóa sản phẩm vì sản phẩm đã xuất hiện trong hóa đơn.",
                    exception
            );
        }
        if (deleted != 1) {
            throw new IllegalStateException("Không thể xóa sản phẩm khỏi cơ sở dữ liệu.");
        }
    }
}
