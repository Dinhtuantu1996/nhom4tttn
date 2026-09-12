package com.nhom4.tttn.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-way compatibility cleanup for databases created by the earlier order flow.
 * CONFIRMED used to be an intermediate state. In the current flow ADMIN approval
 * finishes the order immediately, so legacy CONFIRMED rows are equivalent to COMPLETED.
 */
@Component
@RequiredArgsConstructor
public class OrderStatusMigration implements ApplicationRunner {
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.update("""
                UPDATE orders
                SET status = 'COMPLETED',
                    completed_date = COALESCE(completed_date, updated_date, created_date, CURRENT_TIMESTAMP)
                WHERE status = 'CONFIRMED'
                """);
    }
}
