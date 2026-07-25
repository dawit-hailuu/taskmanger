package com.taskmanager.storage;

import com.taskmanager.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * Stores files on the local filesystem under {@code app.storage.location},
 * served back out via the {@code /uploads/**} resource handler (see
 * {@code WebConfig}). Swappable for a cloud-backed {@link StorageService} in
 * production without touching callers.
 */
@Service
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private final Path rootLocation;
    private final String baseUrl;

    public LocalStorageService(@Value("${app.storage.location}") String location,
                               @Value("${app.storage.base-url}") String baseUrl) {
        this.rootLocation = Paths.get(location).toAbsolutePath().normalize();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        try {
            Files.createDirectories(rootLocation);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize storage directory: " + rootLocation, e);
        }
    }

    @Override
    public String store(MultipartFile file, String subfolder) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was provided.");
        }

        String extension = extensionOf(file.getOriginalFilename());
        String filename = UUID.randomUUID() + extension;

        Path targetDir = rootLocation.resolve(subfolder).normalize();
        if (!targetDir.startsWith(rootLocation)) {
            // Defends against a subfolder value containing ".." path traversal.
            throw new BadRequestException("Invalid storage subfolder.");
        }

        try {
            Files.createDirectories(targetDir);
            Path target = targetDir.resolve(filename);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return baseUrl + "/" + subfolder + "/" + filename;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store file " + filename, e);
        }
    }

    @Override
    public void delete(String publicUrl) {
        if (!StringUtils.hasText(publicUrl) || !publicUrl.startsWith(baseUrl)) {
            return;
        }
        String relative = publicUrl.substring(baseUrl.length()).replaceFirst("^/", "");
        Path target = rootLocation.resolve(relative).normalize();

        if (!target.startsWith(rootLocation)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            // Best-effort cleanup; a stray orphaned file is not worth failing the request over.
            log.warn("Could not delete stored file {}: {}", target, e.getMessage());
        }
    }

    private String extensionOf(String originalFilename) {
        if (!StringUtils.hasText(originalFilename)) {
            return "";
        }
        int dot = originalFilename.lastIndexOf('.');
        return dot >= 0 ? originalFilename.substring(dot).toLowerCase() : "";
    }
}
