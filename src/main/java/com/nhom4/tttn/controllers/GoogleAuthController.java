package com.nhom4.tttn.controllers;

import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.service.GoogleLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class GoogleAuthController {
    private final GoogleLoginService googleLoginService;
    private final SecurityContextRepository securityContextRepository;

    @PostMapping("/auth/google")
    public String googleLogin(
            @RequestParam("credential") String credential,
            HttpServletRequest request,
            HttpServletResponse response,
            RedirectAttributes redirect
    ) {
        try {
            User user = googleLoginService.login(credential);
            var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
            var authentication = UsernamePasswordAuthenticationToken.authenticated(
                    user.getEmail(),
                    null,
                    authorities
            );
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            if (request.getSession(false) != null) {
                request.changeSessionId();
            }
            securityContextRepository.saveContext(context, request, response);
            redirect.addFlashAttribute("success", "Đăng nhập Google thành công.");
            return "redirect:/products";
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("googleError", exception.getMessage());
            return "redirect:/login";
        }
    }
}
