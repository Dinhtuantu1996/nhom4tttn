package com.nhom4.tttn.dto;

import com.nhom4.tttn.enums.ProductAgeGroup;
import com.nhom4.tttn.enums.ProductGender;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ProductForm {
    private Long id;

    @NotBlank(message = "Ten san pham khong duoc de trong")
    @Size(max = 255, message = "Ten san pham toi da 255 ky tu")
    private String name;

    @NotBlank(message = "Mo ta khong duoc de trong")
    @Size(max = 10_000, message = "Mo ta toi da 10000 ky tu")
    private String description;

    private ProductGender gender;
    private ProductAgeGroup ageGroup;

    @NotEmpty(message = "Hay chon it nhat mot danh muc")
    private List<Long> categoryIds = new ArrayList<>();

    private List<Long> deleteImageIds = new ArrayList<>();

}
