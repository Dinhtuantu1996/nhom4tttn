package com.nhom4.tttn.service;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;

@Service
public class LocalFileStorageService {
    private final S3Client s3Client;
    private final String bucket;

    public LocalFileStorageService(
            @Value("${app.r2.endpoint}") String endpoint,
            @Value("${app.r2.access-key}") String accessKey,
            @Value("${app.r2.secret-key}") String secretKey,
            @Value("${app.r2.bucket}") String bucket
    ) {
        this.bucket = bucket;

        AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKey, secretKey);
        S3Configuration configuration = S3Configuration.builder()
                .pathStyleAccessEnabled(true)
                .chunkedEncodingEnabled(false)
                .build();

        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .region(Region.of("auto"))
                .serviceConfiguration(configuration)
                .build();
    }

    public void storeProductFile(Long productId, String filename, MultipartFile file) {
        validateFilename(filename);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File ảnh không hợp lệ.");
        }

        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(productKey(productId, filename))
                    .contentType(contentType)
                    .build();

            s3Client.putObject(
                    request,
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize())
            );
        } catch (IOException | RuntimeException exception) {
            throw new IllegalStateException("Không thể lưu file " + filename, exception);
        }
    }

    public void deleteProductFile(Long productId, String filename) {
        validateFilename(filename);

        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(productKey(productId, filename))
                    .build();
            s3Client.deleteObject(request);
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Không thể xóa file " + filename, exception);
        }
    }

    private String productKey(Long productId, String filename) {
        return "products/" + productId + "/" + filename;
    }

    private void validateFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Tên file không hợp lệ.");
        }
        if (filename.contains("/") || filename.contains("\\")
                || filename.equals(".") || filename.equals("..")) {
            throw new IllegalArgumentException("Tên file không hợp lệ.");
        }
    }

    @PreDestroy
    public void close() {
        s3Client.close();
    }
}
