package com.nhom4.tttn.dto;

public record CreateOrderResponse(
        boolean success,
        String message,
        String orderCode,
        String redirectUrl,
        CartValidationResponse cart
) {
    public static CreateOrderResponse success(String message, String orderCode, String redirectUrl) {
        return new CreateOrderResponse(true, message, orderCode, redirectUrl, null);
    }

    public static CreateOrderResponse cartChanged(String message, CartValidationResponse cart) {
        return new CreateOrderResponse(false, message, null, null, cart);
    }

    public static CreateOrderResponse error(String message) {
        return new CreateOrderResponse(false, message, null, null, null);
    }
}
