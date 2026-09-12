package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.CartValidationRequest;
import com.nhom4.tttn.dto.CartValidationResponse;
import com.nhom4.tttn.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@RequiredArgsConstructor
public class CartController {
    private final CartService cartService;

    @GetMapping("/cart")
    public String cart() {
        return "redirect:/products?cart=open";
    }

    @PostMapping(value = "/api/cart/validate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public CartValidationResponse validate(@RequestBody(required = false) CartValidationRequest request) {
        return cartService.validate(request == null ? null : request.items());
    }
}
