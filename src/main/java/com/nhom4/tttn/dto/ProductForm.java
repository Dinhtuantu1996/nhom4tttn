package com.nhom4.tttn.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ProductForm {
    private Long id;

    @NotBlank(message = "Tên sản phẩm không được để trống.")
    @Size(max = 255, message = "Tên sản phẩm tối đa 255 ký tự.")
    private String name;

    @NotBlank(message = "Mô tả không được để trống.")
    @Size(max = 10_000, message = "Mô tả tối đa 10.000 ký tự.")
    private String description;

    @NotNull(message = "Giá tiền không được để trống.")
    @DecimalMin(value = "0", message = "Giá tiền phải lớn hơn hoặc bằng 0.")
    @Digits(integer = 15, fraction = 0, message = "Giá tiền chỉ nhận số nguyên tối đa 15 chữ số.")
    private BigDecimal price = BigDecimal.ZERO;

    @NotNull(message = "Số lượng không được để trống.")
    @Min(value = 0, message = "Số lượng phải lớn hơn hoặc bằng 0.")
    private Integer quantity = 0;

    @NotEmpty(message = "Hãy chọn ít nhất một danh mục.")
    private List<Long> categoryIds = new ArrayList<>();

    private List<Long> attributeIds = new ArrayList<>();

    private List<Long> deleteImageIds = new ArrayList<>();
}
