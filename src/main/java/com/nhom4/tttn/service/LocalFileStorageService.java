package com.nhom4.tttn.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
public class LocalFileStorageService {
    private final Path uploadRoot;

    public LocalFileStorageService(@Value("${app.upload-dir}") String uploadDir) {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public String storeProductFile(Long productId, MultipartFile file) {
        if (file == null || file.isEmpty()) return null;

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new IllegalArgumentException("File khong co ten.");
        }

        // getFileName() loai bo ../ hoac duong dan tu trinh duyet, nhung van giu nguyen ten file that.
        String filename = Path.of(originalName).getFileName().toString();
        if (filename.isBlank() || filename.equals(".") || filename.equals("..")) {
            throw new IllegalArgumentException("Ten file khong hop le.");
        }

        Path productDir = uploadRoot.resolve("products").resolve(productId.toString()).normalize();
        Path target = productDir.resolve(filename).normalize();
        if (!target.startsWith(productDir)) {
            throw new IllegalArgumentException("Ten file khong hop le.");
        }

        try {
            Files.createDirectories(productDir);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return filename;
        } catch (IOException exception) {
            throw new IllegalStateException("Khong the luu file " + filename, exception);
        }
    }

    public void deleteProductFile(Long productId, String filename) {
        try {
            Files.deleteIfExists(uploadRoot.resolve("products").resolve(productId.toString()).resolve(filename).normalize());
        } catch (IOException exception) {
            throw new IllegalStateException("Khong the xoa file " + filename, exception);
        }
    }

    public void deleteProductFolder(Long productId) {
        Path folder = uploadRoot.resolve("products").resolve(productId.toString()).normalize();
        if (!Files.exists(folder)) return;
        try (var paths = Files.walk(folder)) {
            paths.sorted((a, b) -> b.compareTo(a)).forEach(path -> {
                try { Files.deleteIfExists(path); }
                catch (IOException e) { throw new IllegalStateException(e); }
            });
        } catch (IOException exception) {
            throw new IllegalStateException("Khong the xoa folder upload cua san pham.", exception);
        }
    }
}
