package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.StatisticsDashboard;
import com.nhom4.tttn.repository.StatisticsQueryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatisticsService {
    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DAY_KEY = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter MONTH_KEY = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MM/yyyy");

    private final StatisticsQueryRepository statisticsQueryRepository;

    public StatisticsDashboard dashboard(String requestedRange, LocalDate customFrom, LocalDate customTo) {
        DateRange range = resolveRange(requestedRange, customFrom, customTo);
        LocalDateTime start = range.from().atStartOfDay();
        LocalDateTime endExclusive = range.to().plusDays(1).atStartOfDay();

        StatisticsQueryRepository.OrderCounts counts = statisticsQueryRepository.getOrderCounts(start, endExclusive);
        BigDecimal revenue = statisticsQueryRepository.getCompletedRevenue(start, endExclusive);
        long soldQuantity = statisticsQueryRepository.getCompletedSoldQuantity(start, endExclusive);

        StatisticsDashboard.Overview overview = new StatisticsDashboard.Overview(
                revenue,
                counts.total(),
                counts.completed(),
                counts.pending(),
                counts.cancelled(),
                soldQuantity
        );

        boolean monthly = ChronoUnit.DAYS.between(range.from(), range.to()) > 62;
        List<StatisticsDashboard.RevenuePoint> revenuePoints = monthly
                ? buildMonthlyRevenue(range, start, endExclusive)
                : buildDailyRevenue(range, start, endExclusive);

        return new StatisticsDashboard(
                range.key(),
                range.from(),
                range.to(),
                range.label(),
                monthly ? "Theo tháng" : "Theo ngày",
                overview,
                revenuePoints,
                statisticsQueryRepository.getTopSellingProducts(start, endExclusive, 10),
                statisticsQueryRepository.getTopViewedProducts(10),
                statisticsQueryRepository.getInventory(),
                statisticsQueryRepository.getLowStockProducts(5, 10)
        );
    }

    private List<StatisticsDashboard.RevenuePoint> buildDailyRevenue(
            DateRange range,
            LocalDateTime start,
            LocalDateTime endExclusive
    ) {
        Map<String, StatisticsQueryRepository.RevenueAggregate> values =
                statisticsQueryRepository.getDailyRevenue(start, endExclusive);
        List<StatisticsDashboard.RevenuePoint> result = new ArrayList<>();

        for (LocalDate date = range.from(); !date.isAfter(range.to()); date = date.plusDays(1)) {
            String key = date.format(DAY_KEY);
            StatisticsQueryRepository.RevenueAggregate aggregate = values.get(key);
            result.add(new StatisticsDashboard.RevenuePoint(
                    key,
                    date.format(DAY_LABEL),
                    aggregate == null ? BigDecimal.ZERO : aggregate.revenue(),
                    aggregate == null ? 0L : aggregate.orderCount()
            ));
        }
        return result;
    }

    private List<StatisticsDashboard.RevenuePoint> buildMonthlyRevenue(
            DateRange range,
            LocalDateTime start,
            LocalDateTime endExclusive
    ) {
        Map<String, StatisticsQueryRepository.RevenueAggregate> values =
                statisticsQueryRepository.getMonthlyRevenue(start, endExclusive);
        List<StatisticsDashboard.RevenuePoint> result = new ArrayList<>();

        YearMonth first = YearMonth.from(range.from());
        YearMonth last = YearMonth.from(range.to());
        for (YearMonth month = first; !month.isAfter(last); month = month.plusMonths(1)) {
            String key = month.format(MONTH_KEY);
            StatisticsQueryRepository.RevenueAggregate aggregate = values.get(key);
            result.add(new StatisticsDashboard.RevenuePoint(
                    key,
                    month.format(MONTH_LABEL),
                    aggregate == null ? BigDecimal.ZERO : aggregate.revenue(),
                    aggregate == null ? 0L : aggregate.orderCount()
            ));
        }
        return result;
    }

    private DateRange resolveRange(String requestedRange, LocalDate customFrom, LocalDate customTo) {
        LocalDate today = LocalDate.now();
        String range = requestedRange == null ? "30d" : requestedRange.toLowerCase(Locale.ROOT).trim();

        if ("custom".equals(range) && customFrom != null && customTo != null) {
            LocalDate from = customFrom.isAfter(customTo) ? customTo : customFrom;
            LocalDate to = customFrom.isAfter(customTo) ? customFrom : customTo;
            return new DateRange("custom", from, to, from.format(DISPLAY_DATE) + " - " + to.format(DISPLAY_DATE));
        }

        return switch (range) {
            case "today" -> new DateRange("today", today, today, "Hôm nay");
            case "7d" -> new DateRange("7d", today.minusDays(6), today, "7 ngày gần nhất");
            case "month" -> new DateRange("month", today.withDayOfMonth(1), today, "Tháng này");
            case "year" -> new DateRange("year", today.withDayOfYear(1), today, "Năm nay");
            default -> new DateRange("30d", today.minusDays(29), today, "30 ngày gần nhất");
        };
    }

    private record DateRange(String key, LocalDate from, LocalDate to, String label) {
    }
}
