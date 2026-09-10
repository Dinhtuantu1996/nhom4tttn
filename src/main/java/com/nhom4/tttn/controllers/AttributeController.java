package com.nhom4.tttn.controllers;

import com.nhom4.tttn.service.AttributeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequiredArgsConstructor
@RequestMapping("/attributes")
public class AttributeController {
    private final AttributeService attributeService;

    @PostMapping("/save")
    public String save(
            @RequestParam(required = false) Long id,
            @RequestParam String name,
            @RequestParam(required = false) Long parentId,
            RedirectAttributes redirect
    ) {
        try {
            attributeService.save(id, name, parentId);
            redirect.addFlashAttribute(
                    "success",
                    id == null ? "Thêm thuộc tính/giá trị thành công." : "Cập nhật thuộc tính/giá trị thành công."
            );
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:/products";
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        try {
            attributeService.delete(id);
            redirect.addFlashAttribute("success", "Xóa thuộc tính/giá trị thành công.");
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:/products";
    }
}
