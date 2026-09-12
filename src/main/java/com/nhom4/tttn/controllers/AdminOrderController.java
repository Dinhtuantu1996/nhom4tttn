package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.OrderActionResult;
import com.nhom4.tttn.enums.OrderStatus;
import com.nhom4.tttn.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequiredArgsConstructor
@RequestMapping("/admin/orders")
public class AdminOrderController {
    private final OrderService orderService;

    @GetMapping
    public String list(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            Model model
    ) {
        model.addAttribute("orders", orderService.searchAdmin(status, keyword, page, 20));
        model.addAttribute("statuses", OrderStatus.values());
        model.addAttribute("status", status);
        model.addAttribute("keyword", keyword);
        return "admin-orders";
    }

    @GetMapping("/{id}")
    public String detail(@PathVariable Long id, Model model) {
        model.addAttribute("review", orderService.review(id));
        return "admin-order-detail";
    }

    @PostMapping("/{id}/complete")
    public String complete(@PathVariable Long id, RedirectAttributes redirect) {
        return handleAction(id, redirect, () -> orderService.complete(id));
    }

    @PostMapping("/{id}/cancel")
    public String cancel(@PathVariable Long id, RedirectAttributes redirect) {
        return handleAction(id, redirect, () -> orderService.cancel(id));
    }

    private String handleAction(Long id, RedirectAttributes redirect, Action action) {
        try {
            OrderActionResult result = action.run();
            redirect.addFlashAttribute("success", result.message());
            if (result.hasWarnings()) {
                redirect.addFlashAttribute("warning", String.join(" ", result.warnings()));
            }
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:/admin/orders/" + id;
    }

    @FunctionalInterface
    private interface Action {
        OrderActionResult run();
    }
}
