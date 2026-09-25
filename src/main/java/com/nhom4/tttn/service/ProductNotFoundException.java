package com.nhom4.tttn.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class ProductNotFoundException extends RuntimeException {
    public ProductNotFoundException(Long id) {
        super("Không tìm thấy sản phẩm ID " + id);
    }
}
