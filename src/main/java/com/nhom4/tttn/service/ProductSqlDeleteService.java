package com.nhom4.tttn.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductSqlDeleteService {
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void deleteProductData(Long productId) {
        jdbcTemplate.update("DELETE FROM product_images WHERE product_id = ?", productId);
        jdbcTemplate.update("DELETE FROM product_attributes WHERE product_id = ?", productId);
        jdbcTemplate.update("DELETE FROM product_categories WHERE product_id = ?", productId);

        int deleted = jdbcTemplate.update("DELETE FROM products WHERE id = ?", productId);
        if (deleted != 1) {
            throw new IllegalStateException("Không thể xóa sản phẩm khỏi cơ sở dữ liệu.");
        }
    }
}
