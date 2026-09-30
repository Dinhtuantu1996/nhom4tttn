package com.nhom4.tttn.controllers;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.util.UriComponentsBuilder;

@Controller
public class MediaController {
    private final String publicUrl;

    public MediaController(@Value("${app.r2.public-url}") String publicUrl) {
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    @GetMapping("/uploads/products/{productId}/{filename:.+}")
    public String productImage(
            @PathVariable Long productId,
            @PathVariable String filename) {
        String url = UriComponentsBuilder
                .fromUriString(publicUrl)
                .pathSegment("products", productId.toString(), filename)
                .build()
                .encode()
                .toUriString();
        return "redirect:" + url;
    }
}
