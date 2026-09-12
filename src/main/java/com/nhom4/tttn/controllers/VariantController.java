package com.nhom4.tttn.controllers;

import com.nhom4.tttn.service.VariantService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequiredArgsConstructor
@RequestMapping("/variants")
public class VariantController {
    private final VariantService variantService;

    @PostMapping("/save")
    public String save(
            @RequestParam(required = false) Long id,
            @RequestParam String name,
            @RequestParam(required = false) Long parentId,
            RedirectAttributes redirect
    ) {
        try {
            variantService.save(id, name, parentId);
            redirect.addFlashAttribute(
                    "success",
                    id == null ? "Thêm biến thể/giá trị thành công." : "Cập nhật biến thể/giá trị thành công."
            );
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:/products";
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        try {
            variantService.delete(id);
            redirect.addFlashAttribute("success", "Xóa biến thể/giá trị thành công.");
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:/products";
    }
}
