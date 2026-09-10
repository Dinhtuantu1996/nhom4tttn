package com.nhom4.tttn.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final Path uploadRoot;

    public WebConfig(@Value("${app.upload-dir}") String uploadDir) {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadRoot);
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể khởi tạo thư mục upload.", exception);
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = uploadRoot.toUri().toString();
        if (!location.endsWith("/")) {
            location += "/";
        }

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location);
    }
}
