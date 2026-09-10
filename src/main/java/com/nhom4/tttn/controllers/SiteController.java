package com.nhom4.tttn.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import com.nhom4.tttn.service.ProductService;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@RequiredArgsConstructor
public class SiteController {
    private final ProductService productService;

    @Value("${app.google.client-id:}")
    private String googleClientId;

    @GetMapping("/")
    public String home(Model model) {
        model.addAttribute("newestProducts", productService.latestUpdated());
        return "home";
    }

    @GetMapping("/contact")
    public String contact() { return "contact"; }

    @GetMapping("/login")
    public String login(Authentication authentication, Model model) {
        if (authentication != null && authentication.isAuthenticated() && !(authentication instanceof AnonymousAuthenticationToken)) return "redirect:/";
        model.addAttribute("googleClientId", googleClientId == null ? "" : googleClientId.trim());
        return "login";
    }

    @GetMapping({"/forgot-password", "/register"})
    public String comingSoon() { return "coming-soon"; }
}
