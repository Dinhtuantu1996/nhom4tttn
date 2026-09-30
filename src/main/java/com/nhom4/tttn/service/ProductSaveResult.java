package com.nhom4.tttn.service;

import com.nhom4.tttn.entity.Product;

public record ProductSaveResult(Product product, ImageChangeResult images) {
    public String successMessage() {
        StringBuilder message = new StringBuilder("Lưu sản phẩm thành công.");

        if (images.deleteRequested() > 0) {
            message.append(" Đã xóa ")
                    .append(images.deleteSucceeded())
                    .append('/')
                    .append(images.deleteRequested())
                    .append(" ảnh.");
        }

        if (images.uploadRequested() > 0) {
            message.append(" Đã tải lên ")
                    .append(images.uploadSucceeded())
                    .append('/')
                    .append(images.uploadRequested())
                    .append(" ảnh.");
        }

        return message.toString();
    }
}
