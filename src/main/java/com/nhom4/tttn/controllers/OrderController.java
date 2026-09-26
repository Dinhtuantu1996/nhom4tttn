package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.CreateOrderRequest;
import com.nhom4.tttn.dto.CreateOrderResponse;
import com.nhom4.tttn.dto.OrderSummaryView;
import com.nhom4.tttn.entity.CustomerOrder;
import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.enums.OrderStatus;
import com.nhom4.tttn.repository.UserRepository;
import com.nhom4.tttn.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Controller
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    private final UserRepository userRepository;

    @GetMapping("/checkout")
    public String checkout() {
        return "checkout";
    }

    @PostMapping(value = "/api/orders", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<CreateOrderResponse> create(
            @RequestBody CreateOrderRequest request,
            Authentication authentication
    ) {
        try {
            User currentUser = currentUser(authentication);
            OrderService.CreateResult result = orderService.create(request, currentUser);
            if (!result.created()) {
                String message = !result.cartChanged().messages().isEmpty()
                        ? String.join(" ", result.cartChanged().messages())
                        : (result.cartChanged().checkoutAllowed()
                        ? "Giỏ hàng vừa thay đổi. Vui lòng kiểm tra lại trước khi đặt hàng."
                        : "Có sản phẩm đang chọn số lượng lớn hơn tồn kho. Vui lòng giảm số lượng trong giỏ hàng trước khi đặt hàng.");
                return ResponseEntity.status(HttpStatus.CONFLICT).body(CreateOrderResponse.cartChanged(
                        message,
                        result.cartChanged()
                ));
            }

            CustomerOrder order = result.order();
            String redirectUrl = currentUser == null
                    ? "/orders/success?code=" + order.getCode()
                    : "/orders/my/" + order.getCode();
            return ResponseEntity.ok(CreateOrderResponse.success(
                    "Đặt hàng thành công. Đơn hàng đang chờ cửa hàng xác nhận.",
                    order.getCode(),
                    redirectUrl
            ));
        } catch (RuntimeException exception) {
            return ResponseEntity.badRequest().body(CreateOrderResponse.error(exception.getMessage()));
        }
    }

    @GetMapping("/orders/success")
    public String success(@RequestParam String code, Model model) {
        model.addAttribute("orderCode", code == null ? "" : code.trim().toUpperCase());
        return "order-success";
    }

    @GetMapping("/orders")
    public String guestOrders(
            @RequestParam(defaultValue = "") String code,
            @RequestParam(defaultValue = "") String email,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "created") String sort,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication,
            Model model
    ) {
        if (currentUser(authentication) != null) {
            return isAdmin(authentication) ? "redirect:/admin/orders" : "redirect:/orders/my";
        }
        prepareGuestOrdersModel(code, email, page, sort, direction, model);
        return "order-management";
    }

    @GetMapping("/orders/{code}/modal")
    public String guestOrderDetailModal(
            @PathVariable String code,
            @RequestParam String email,
            Model model
    ) {
        try {
            model.addAttribute("review", orderService.reviewGuest(code, email));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage());
        }
        model.addAttribute("adminMode", false);
        return "fragments/order-management-detail-modal-content :: content";
    }

    @GetMapping("/orders/{code}")
    public String guestOrderDetail(
            @PathVariable String code,
            @RequestParam String email,
            Model model
    ) {
        try {
            model.addAttribute("review", orderService.reviewGuest(code, email));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage());
        }
        model.addAttribute("adminMode", false);
        model.addAttribute("guestMode", true);
        model.addAttribute("guestEmail", email == null ? "" : email.trim());
        return "order-management-detail";
    }

    @GetMapping("/orders/my/{code}/modal")
    public String myOrderDetailModal(@PathVariable String code, Authentication authentication, Model model) {
        String email = requireCustomerEmail(authentication);
        model.addAttribute("review", orderService.reviewMine(email, code));
        model.addAttribute("adminMode", false);
        return "fragments/order-management-detail-modal-content :: content";
    }

    @GetMapping("/orders/my")
    public String myOrders(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "created") String sort,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication,
            Model model
    ) {
        String email = requireCustomerEmail(authentication);
        prepareMyOrdersModel(email, status, keyword, page, sort, direction, model);
        return "order-management";
    }

    @GetMapping("/orders/my/{code}")
    public String myOrderDetail(@PathVariable String code, Authentication authentication, Model model) {
        String email = requireCustomerEmail(authentication);
        model.addAttribute("review", orderService.reviewMine(email, code));
        model.addAttribute("adminMode", false);
        model.addAttribute("guestMode", false);
        return "order-management-detail";
    }

    private void prepareGuestOrdersModel(
            String code,
            String email,
            int page,
            String sort,
            String direction,
            Model model
    ) {
        String safeCode = code == null ? "" : code.trim().toUpperCase();
        String safeEmail = email == null ? "" : email.trim();
        String safeSort = OrderService.normalizeOrderSort(sort);
        String safeDirection = OrderService.normalizeSortDirection(direction);

        Page<OrderSummaryView> orders;
        String searchError = null;
        if (safeCode.isBlank() && safeEmail.isBlank()) {
            orders = orderService.searchGuest("", "", page, 10, safeSort, safeDirection);
        } else if (safeCode.isBlank() || safeEmail.isBlank()) {
            orders = orderService.searchGuest("", "", page, 10, safeSort, safeDirection);
            searchError = "Vui lòng nhập đầy đủ mã đơn hàng và email đặt hàng.";
        } else {
            try {
                orders = orderService.searchGuest(safeCode, safeEmail, page, 10, safeSort, safeDirection);
                if (orders.isEmpty()) {
                    searchError = "Không tìm thấy đơn hàng với mã và email đã nhập.";
                }
            } catch (IllegalArgumentException exception) {
                orders = orderService.searchGuest("", "", page, 10, safeSort, safeDirection);
                searchError = exception.getMessage();
            }
        }

        preparePageModel(orders, safeSort, safeDirection, model);
        model.addAttribute("orderMode", "GUEST");
        model.addAttribute("orderListPath", "/orders");
        model.addAttribute("code", safeCode);
        model.addAttribute("email", safeEmail);
        model.addAttribute("orderSearchError", searchError);
    }

    private void prepareMyOrdersModel(
            String email,
            OrderStatus status,
            String keyword,
            int page,
            String sort,
            String direction,
            Model model
    ) {
        String safeSort = OrderService.normalizeOrderSort(sort);
        String safeDirection = OrderService.normalizeSortDirection(direction);
        Page<OrderSummaryView> orders = orderService.searchMine(
                email, status, keyword, page, 10, safeSort, safeDirection
        );

        preparePageModel(orders, safeSort, safeDirection, model);
        model.addAttribute("orderMode", "USER");
        model.addAttribute("orderListPath", "/orders/my");
        model.addAttribute("statuses", OrderStatus.values());
        model.addAttribute("status", status);
        model.addAttribute("keyword", keyword == null ? "" : keyword);
    }

    private void preparePageModel(
            Page<OrderSummaryView> orders,
            String sort,
            String direction,
            Model model
    ) {
        int totalPages = orders.getTotalPages();
        int pageStart = 0;
        int pageEnd = -1;
        if (totalPages > 0) {
            pageStart = Math.max(0, orders.getNumber() - 2);
            pageEnd = Math.min(totalPages - 1, pageStart + 4);
            pageStart = Math.max(0, pageEnd - 4);
        }

        model.addAttribute("orders", orders);
        model.addAttribute("sort", sort);
        model.addAttribute("direction", direction);
        model.addAttribute("pageStart", pageStart);
        model.addAttribute("pageEnd", pageEnd);
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return userRepository.findByEmailIgnoreCase(authentication.getName()).orElse(null);
    }

    private String requireCustomerEmail(Authentication authentication) {
        if (isAdmin(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return requireAuthenticatedEmail(authentication);
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private String requireAuthenticatedEmail(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            throw new IllegalStateException("Bạn cần đăng nhập để xem lịch sử đơn hàng.");
        }
        String email = authentication.getName();
        if (email == null || email.isBlank()) {
            throw new IllegalStateException("Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");
        }
        return email.trim();
    }
}
