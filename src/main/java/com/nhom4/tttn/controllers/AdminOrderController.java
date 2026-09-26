package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.OrderSummaryView;
import com.nhom4.tttn.enums.OrderStatus;
import com.nhom4.tttn.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequiredArgsConstructor
@RequestMapping("/admin/orders")
public class AdminOrderController {
    private static final String AJAX_HEADER = "XMLHttpRequest";

    private final OrderService orderService;

    @GetMapping
    public String list(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "created") String sort,
            @RequestParam(defaultValue = "desc") String direction,
            Model model
    ) {
        prepareListModel(status, keyword, page, sort, direction, model);
        return "admin-orders";
    }

    @GetMapping("/{id}")
    public String detail(@PathVariable Long id, Model model) {
        model.addAttribute("review", orderService.review(id));
        model.addAttribute("adminMode", true);
        return "order-management-detail";
    }

    @GetMapping("/{id}/modal")
    public String detailModal(@PathVariable Long id, Model model) {
        model.addAttribute("review", orderService.review(id));
        model.addAttribute("adminMode", true);
        return "fragments/order-management-detail-modal-content :: content";
    }

    @PostMapping("/{id}/complete")
    public String complete(
            @PathVariable Long id,
            @RequestHeader(name = "X-Requested-With", required = false) String requestedWith,
            Model model,
            RedirectAttributes redirect
    ) {
        return handleAction(id, requestedWith, model, redirect, () -> orderService.complete(id));
    }

    @PostMapping("/{id}/cancel")
    public String cancel(
            @PathVariable Long id,
            @RequestHeader(name = "X-Requested-With", required = false) String requestedWith,
            Model model,
            RedirectAttributes redirect
    ) {
        return handleAction(id, requestedWith, model, redirect, () -> orderService.cancel(id));
    }

    private String handleAction(
            Long id,
            String requestedWith,
            Model model,
            RedirectAttributes redirect,
            Action action
    ) {
        String success = null;
        String error = null;
        try {
            success = action.run();
        } catch (RuntimeException exception) {
            error = exception.getMessage();
        }

        if (AJAX_HEADER.equals(requestedWith)) {
            model.addAttribute("review", orderService.review(id));
            model.addAttribute("adminMode", true);
            model.addAttribute("success", success);
            model.addAttribute("error", error);
            return "fragments/order-management-detail-modal-content :: content";
        }

        if (success != null) redirect.addFlashAttribute("success", success);
        if (error != null) redirect.addFlashAttribute("error", error);
        return "redirect:/admin/orders/" + id;
    }

    private void prepareListModel(
            OrderStatus status,
            String keyword,
            int page,
            String sort,
            String direction,
            Model model
    ) {
        String safeSort = OrderService.normalizeOrderSort(sort);
        String safeDirection = OrderService.normalizeSortDirection(direction);
        Page<OrderSummaryView> orders = orderService.searchAdmin(
                status, keyword, page, 10, safeSort, safeDirection
        );

        int totalPages = orders.getTotalPages();
        int pageStart = 0;
        int pageEnd = -1;
        if (totalPages > 0) {
            pageStart = Math.max(0, orders.getNumber() - 2);
            pageEnd = Math.min(totalPages - 1, pageStart + 4);
            pageStart = Math.max(0, pageEnd - 4);
        }

        model.addAttribute("orders", orders);
        model.addAttribute("statuses", OrderStatus.values());
        model.addAttribute("status", status);
        model.addAttribute("keyword", keyword);
        model.addAttribute("sort", safeSort);
        model.addAttribute("direction", safeDirection);
        model.addAttribute("pageStart", pageStart);
        model.addAttribute("pageEnd", pageEnd);
    }

    @FunctionalInterface
    private interface Action {
        String run();
    }
}
