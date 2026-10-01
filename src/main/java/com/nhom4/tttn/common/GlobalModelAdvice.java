package com.nhom4.tttn.common;

import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.repository.UserRepository;
import com.nhom4.tttn.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import java.util.List;

@ControllerAdvice
@RequiredArgsConstructor
public class GlobalModelAdvice {
    private final CategoryService categoryService;
    private final UserRepository userRepository;

    @ModelAttribute("navCategories")
    public Object navCategories() {
        try {
            return categoryService.roots();
        } catch (RuntimeException ignored) {
            return List.of();
        }
    }

    @ModelAttribute("currentUser")
    public User currentUser(Authentication authentication) {
        if (!SecurityUtils.isAuthenticated(authentication)) return null;
        return userRepository.findByEmailIgnoreCase(authentication.getName()).orElse(null);
    }

    @ModelAttribute("isAdmin")
    public boolean isAdmin(Authentication authentication) {
        return SecurityUtils.isAdmin(authentication);
    }
}
