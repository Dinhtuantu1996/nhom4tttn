package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.CreateOrderRequest;
import com.nhom4.tttn.dto.CreateOrderResponse;
import com.nhom4.tttn.entity.CustomerOrder;
import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.repository.UserRepository;
import com.nhom4.tttn.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;


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
                String message = result.cartChanged().checkoutAllowed()
                        ? "Giỏ hàng vừa thay đổi. Vui lòng kiểm tra lại trước khi đặt hàng."
                        : "Có sản phẩm đang chọn số lượng lớn hơn tồn kho. Vui lòng giảm số lượng trong giỏ hàng trước khi đặt hàng.";
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
                    "Đặt hàng thành công. Đơn đang chờ ADMIN duyệt.",
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

    @GetMapping("/orders/lookup")
    public String lookupForm() {
        return "order-lookup";
    }

    @PostMapping("/orders/lookup")
    public String lookup(
            @RequestParam String code,
            @RequestParam String email,
            Model model
    ) {
        try {
            model.addAttribute("order", orderService.lookup(code, email));
            model.addAttribute("lookupMode", true);
            return "order-detail";
        } catch (RuntimeException exception) {
            model.addAttribute("lookupError", exception.getMessage());
            model.addAttribute("lookupCode", code);
            model.addAttribute("lookupEmail", email);
            return "order-lookup";
        }
    }

    @GetMapping("/orders/my")
    public String myOrders(Authentication authentication, Model model) {
        String email = requireAuthenticatedEmail(authentication);
        model.addAttribute("accountEmail", email);
        model.addAttribute("orders", orderService.findMine(email));
        return "my-orders";
    }

    @GetMapping("/orders/my/{code}")
    public String myOrderDetail(@PathVariable String code, Authentication authentication, Model model) {
        String email = requireAuthenticatedEmail(authentication);
        model.addAttribute("order", orderService.findMineByCode(email, code));
        model.addAttribute("lookupMode", false);
        return "order-detail";
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return userRepository.findByEmailIgnoreCase(authentication.getName()).orElse(null);
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
