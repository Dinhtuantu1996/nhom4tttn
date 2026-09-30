package com.nhom4.tttn.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductImageService {
    private static final Logger log = LoggerFactory.getLogger(ProductImageService.class);

    private final ProductImageDatabaseService imageDatabase;
    private final LocalFileStorageService fileStorage;

    public ImageChangeResult applyChanges(
            Long productId,
            List<Long> deleteImageIds,
            List<MultipartFile> files
    ) {
        List<Long> deleteIds = validDeleteIds(deleteImageIds);
        List<MultipartFile> uploadFiles = validFiles(files);

        int deleted = deleteImages(productId, deleteIds);
        int uploaded = uploadImages(productId, uploadFiles);

        return new ImageChangeResult(
                deleteIds.size(),
                deleted,
                uploadFiles.size(),
                uploaded
        );
    }

    private int deleteImages(Long productId, List<Long> imageIds) {
        int success = 0;

        for (Long imageId : imageIds) {
            ProductImageDatabaseService.ImageRef image;
            try {
                var found = imageDatabase.find(productId, imageId);
                if (found.isEmpty()) {
                    success++;
                    continue;
                }
                image = found.get();
            } catch (RuntimeException exception) {
                log.warn("Không thể đọc ảnh {} của sản phẩm {} để xóa.", imageId, productId, exception);
                continue;
            }

            try {
                fileStorage.deleteProductFile(productId, image.filename());
            } catch (RuntimeException exception) {
                log.warn("Không thể xóa ảnh {} của sản phẩm {} trên R2.", imageId, productId, exception);
                continue;
            }

            try {
                if (imageDatabase.delete(productId, imageId)) {
                    success++;
                }
            } catch (RuntimeException exception) {
                log.warn("Ảnh {} của sản phẩm {} đã xóa trên R2 nhưng chưa xóa được bản ghi DB.",
                        imageId, productId, exception);
            }
        }

        return success;
    }

    private int uploadImages(Long productId, List<MultipartFile> files) {
        int success = 0;

        for (MultipartFile file : files) {
            String filename = uniqueFilename(file);

            try {
                imageDatabase.create(productId, filename);
            } catch (RuntimeException exception) {
                log.warn("Không thể tạo bản ghi DB cho ảnh {} của sản phẩm {}.", filename, productId, exception);
                continue;
            }

            try {
                fileStorage.storeProductFile(productId, filename, file);
                success++;
            } catch (RuntimeException exception) {
                log.warn("Đã tạo bản ghi DB nhưng không thể tải ảnh {} của sản phẩm {} lên R2.",
                        filename, productId, exception);
            }
        }

        return success;
    }

    private List<Long> validDeleteIds(List<Long> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) return List.of();

        Set<Long> unique = new LinkedHashSet<>();
        for (Long imageId : imageIds) {
            if (imageId != null && imageId > 0) unique.add(imageId);
        }
        return List.copyOf(unique);
    }

    private List<MultipartFile> validFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) return List.of();
        return files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();
    }

    private String uniqueFilename(MultipartFile file) {
        return UUID.randomUUID() + extensionOf(file.getOriginalFilename());
    }

    private String extensionOf(String originalName) {
        if (originalName == null || originalName.isBlank()) return "";

        String filename = originalName.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        int dot = filename.lastIndexOf('.');
        if (dot <= 0 || dot == filename.length() - 1) return "";

        String extension = filename.substring(dot + 1);
        if (!extension.matches("[A-Za-z0-9]{1,10}")) return "";
        return "." + extension.toLowerCase(Locale.ROOT);
    }
}
