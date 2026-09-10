package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.ProductForm;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.enums.ProductAgeGroup;
import com.nhom4.tttn.enums.ProductGender;
import com.nhom4.tttn.service.CategoryService;
import com.nhom4.tttn.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class ProductController {
    private static final int PRODUCT_BATCH_SIZE = 12;

    private final ProductService productService;
    private final CategoryService categoryService;

    @GetMapping("/products")
    public String products(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) ProductGender gender,
            @RequestParam(required = false) ProductAgeGroup ageGroup,
            @RequestParam(defaultValue = "newest") String sort,
            Model model
    ) {
        Page<Product> products = productService.search(
                keyword,
                categoryId,
                gender,
                ageGroup,
                sort,
                0,
                PRODUCT_BATCH_SIZE
        );
        prepareCatalog(model, products, keyword, categoryId, gender, ageGroup, sort);
        return "products";
    }

    @GetMapping("/products/more")
    public String moreProducts(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) ProductGender gender,
            @RequestParam(required = false) ProductAgeGroup ageGroup,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "1") int page,
            Model model
    ) {
        Page<Product> products = productService.search(
                keyword,
                categoryId,
                gender,
                ageGroup,
                sort,
                page,
                PRODUCT_BATCH_SIZE
        );
        model.addAttribute("products", products);
        return "fragments/product-batch :: batch";
    }

    @GetMapping("/products/form")
    public String createModal(Model model) {
        prepareForm(model, new ProductForm(), null);
        model.addAttribute("modalMode", true);
        return "fragments/product-form-content :: content";
    }

    @GetMapping("/products/{id}/form")
    public String editModal(@PathVariable Long id, Model model) {
        Product product = productService.getDetailed(id);
        prepareForm(model, productService.toForm(product), product);
        model.addAttribute("modalMode", true);
        return "fragments/product-form-content :: content";
    }

    @GetMapping("/products/new")
    public String create(Model model) {
        prepareForm(model, new ProductForm(), null);
        return "product-form";
    }

    @GetMapping("/products/{id}/edit")
    public String edit(@PathVariable Long id, Model model) {
        Product product = productService.getDetailed(id);
        prepareForm(model, productService.toForm(product), product);
        return "product-form";
    }

    @PostMapping(value = "/products/save", consumes = "multipart/form-data")
    public String save(
            @Valid @ModelAttribute("form") ProductForm form,
            BindingResult bindingResult,
            @RequestParam(name = "imageFiles", required = false) List<MultipartFile> imageFiles,
            Model model,
            RedirectAttributes redirect
    ) {
        Product existing = form.getId() == null ? null : productService.getDetailed(form.getId());
        if (bindingResult.hasErrors()) {
            prepareForm(model, form, existing);
            return "product-form";
        }

        try {
            productService.save(form, imageFiles);
            redirect.addFlashAttribute("success", "Lưu sản phẩm thành công.");
            return "redirect:/products";
        } catch (RuntimeException exception) {
            model.addAttribute("error", exception.getMessage());
            prepareForm(model, form, existing);
            return "product-form";
        }
    }

    @PostMapping("/products/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        try {
            productService.delete(id);
            redirect.addFlashAttribute("success", "Xóa sản phẩm thành công.");
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:/products";
    }

    @GetMapping("/products/{id}/detail")
    public String detailModal(@PathVariable Long id, Model model) {
        model.addAttribute("product", productService.view(id));
        return "fragments/product-detail-modal-content :: content";
    }

    @GetMapping("/products/{id}")
    public String detail(@PathVariable Long id, Model model) {
        model.addAttribute("product", productService.view(id));
        return "product-detail";
    }

    private void prepareCatalog(
            Model model,
            Page<Product> products,
            String keyword,
            Long categoryId,
            ProductGender gender,
            ProductAgeGroup ageGroup,
            String sort
    ) {
        model.addAttribute("products", products);
        model.addAttribute("categories", categoryService.roots());
        model.addAttribute("keyword", keyword);
        model.addAttribute("categoryId", categoryId);
        model.addAttribute("gender", gender);
        model.addAttribute("ageGroup", ageGroup);
        model.addAttribute("sort", sort);
        model.addAttribute("genders", ProductGender.values());
        model.addAttribute("ageGroups", ProductAgeGroup.values());
    }

    private void prepareForm(Model model, ProductForm form, Product product) {
        model.addAttribute("form", form);
        model.addAttribute("product", product);
        model.addAttribute("categories", categoryService.roots());
        model.addAttribute("genders", ProductGender.values());
        model.addAttribute("ageGroups", ProductAgeGroup.values());
    }
}
