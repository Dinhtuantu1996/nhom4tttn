package com.nhom4.tttn.controllers;

import com.nhom4.tttn.dto.ProductForm;
import com.nhom4.tttn.entity.Product;
import com.nhom4.tttn.enums.ProductVisibility;
import com.nhom4.tttn.service.AttributeService;
import com.nhom4.tttn.service.CategoryService;
import com.nhom4.tttn.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.net.URI;
import java.util.List;

@Controller
@RequiredArgsConstructor
public class ProductController {
    private static final int PRODUCT_BATCH_SIZE = 12;

    private final ProductService productService;
    private final CategoryService categoryService;
    private final AttributeService attributeService;

    @GetMapping("/products")
    public String products(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) List<Long> attributeIds,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "VISIBLE") ProductVisibility visibility,
            Authentication authentication,
            Model model
    ) {
        List<Long> selectedAttributeIds = attributeIds == null ? List.of() : attributeIds;
        ProductVisibility effectiveVisibility = visibilityFor(authentication, visibility);
        Page<Product> products = productService.search(
                keyword,
                categoryId,
                selectedAttributeIds,
                sort,
                effectiveVisibility,
                0,
                PRODUCT_BATCH_SIZE
        );
        prepareCatalog(model, products, keyword, categoryId, selectedAttributeIds, sort, effectiveVisibility);
        return "products";
    }

    @GetMapping("/products/more")
    public String moreProducts(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) List<Long> attributeIds,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "VISIBLE") ProductVisibility visibility,
            @RequestParam(defaultValue = "1") int page,
            Authentication authentication,
            Model model
    ) {
        Page<Product> products = productService.search(
                keyword,
                categoryId,
                attributeIds == null ? List.of() : attributeIds,
                sort,
                visibilityFor(authentication, visibility),
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
    public String edit(
            @PathVariable Long id,
            @RequestParam(name = "returnUrl", required = false) String returnUrl,
            Model model
    ) {
        Product product = productService.getDetailed(id);
        prepareForm(model, productService.toForm(product), product);
        model.addAttribute("returnUrl", normalizeReturnUrl(returnUrl));
        return "product-form";
    }

    @PostMapping(value = "/products/save", consumes = "multipart/form-data")
    public String save(
            @Valid @ModelAttribute("form") ProductForm form,
            BindingResult bindingResult,
            @RequestParam(name = "imageFiles", required = false) List<MultipartFile> imageFiles,
            @RequestParam(name = "returnUrl", required = false) String returnUrl,
            @RequestHeader(name = "X-Requested-With", required = false) String requestedWith,
            Model model,
            RedirectAttributes redirect
    ) {
        boolean modalRequest = "XMLHttpRequest".equals(requestedWith);
        String safeReturnUrl = normalizeReturnUrl(returnUrl);
        Product existing = form.getId() == null ? null : productService.getDetailed(form.getId());
        if (bindingResult.hasErrors()) {
            prepareForm(model, form, existing);
            model.addAttribute("returnUrl", safeReturnUrl);
            if (modalRequest) {
                model.addAttribute("modalMode", true);
                return "fragments/product-form-content :: content";
            }
            return "product-form";
        }

        try {
            Product savedProduct = productService.save(form, imageFiles);
            if (modalRequest) {
                model.addAttribute("savedProduct", savedProduct);
                model.addAttribute("successMessage", "Lưu sản phẩm thành công.");
                return "fragments/product-form-success :: content";
            }
            redirect.addFlashAttribute("success", "Lưu sản phẩm thành công.");
            return safeReturnUrl == null ? "redirect:/products" : "redirect:" + safeReturnUrl;
        } catch (RuntimeException exception) {
            model.addAttribute("error", exception.getMessage());
            prepareForm(model, form, existing);
            model.addAttribute("returnUrl", safeReturnUrl);
            if (modalRequest) {
                model.addAttribute("modalMode", true);
                return "fragments/product-form-content :: content";
            }
            return "product-form";
        }
    }

    @PostMapping("/products/{id}/visibility")
    public String setVisibility(
            @PathVariable Long id,
            @RequestParam boolean enable,
            @RequestHeader(name = "Referer", required = false) String referer,
            RedirectAttributes redirect
    ) {
        try {
            productService.setVisibility(id, enable);
            redirect.addFlashAttribute("success", enable ? "Đã hiện sản phẩm." : "Đã ẩn sản phẩm.");
        } catch (RuntimeException exception) {
            redirect.addFlashAttribute("error", exception.getMessage());
        }
        return "redirect:" + normalizeProductsReturnUrl(referer);
    }

    @GetMapping("/products/{id}/detail")
    public String detailModal(
            @PathVariable Long id,
            Authentication authentication,
            Model model
    ) {
        model.addAttribute("product", productService.view(id, isAdmin(authentication)));
        return "fragments/product-detail-modal-content :: content";
    }


    private ProductVisibility visibilityFor(Authentication authentication, ProductVisibility requested) {
        if (!isAdmin(authentication)) return ProductVisibility.VISIBLE;
        return requested == null ? ProductVisibility.VISIBLE : requested;
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private String normalizeProductsReturnUrl(String referer) {
        if (referer == null || referer.isBlank()) return "/products";
        try {
            URI uri = URI.create(referer);
            if (!"/products".equals(uri.getPath())) return "/products";
            String query = uri.getRawQuery();
            return query == null || query.isBlank() ? "/products" : "/products?" + query;
        } catch (IllegalArgumentException ignored) {
            return "/products";
        }
    }

    private String normalizeReturnUrl(String returnUrl) {
        if (returnUrl == null) return null;
        String value = returnUrl.trim();
        return value.matches("^/admin/orders/\\d+$") ? value : null;
    }

    private void prepareCatalog(
            Model model,
            Page<Product> products,
            String keyword,
            Long categoryId,
            List<Long> attributeIds,
            String sort,
            ProductVisibility visibility
    ) {
        model.addAttribute("products", products);
        model.addAttribute("categories", categoryService.roots());
        model.addAttribute("attributes", attributeService.roots());
        model.addAttribute("keyword", keyword);
        model.addAttribute("categoryId", categoryId);
        model.addAttribute("attributeIds", attributeIds);
        model.addAttribute("sort", sort);
        model.addAttribute("visibility", visibility);
    }

    private void prepareForm(Model model, ProductForm form, Product product) {
        model.addAttribute("form", form);
        model.addAttribute("product", product);
        model.addAttribute("categories", categoryService.roots());
        model.addAttribute("attributes", attributeService.roots());
    }
}
