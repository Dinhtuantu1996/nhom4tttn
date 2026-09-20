package com.nhom4.tttn.controllers;

import com.nhom4.tttn.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.LocalDate;

@Controller
@RequiredArgsConstructor
@RequestMapping("/admin/statistics")
public class AdminStatisticsController {
    private final StatisticsService statisticsService;

    @GetMapping
    public String statistics(
            @RequestParam(defaultValue = "30d") String range,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Model model
    ) {
        model.addAttribute("statistics", statisticsService.dashboard(range, from, to));
        return "admin-statistics";
    }
}
