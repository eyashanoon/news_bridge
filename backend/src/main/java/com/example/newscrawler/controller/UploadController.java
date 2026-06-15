package com.example.newscrawler.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private final Path uploadDir;

    public UploadController(@Value("${app.upload.dir:uploads}") String uploadDirStr) throws IOException {
        this.uploadDir = Path.of(uploadDirStr).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDir);
    }

    @PostMapping("/image")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        return saveUpload(file, "image");
    }

    @PostMapping("/video")
    public ResponseEntity<Map<String, String>> uploadVideo(@RequestParam("file") MultipartFile file) {
        return saveUpload(file, "video");
    }

    @GetMapping("/files/{filename}")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) throws IOException {
        if (!isSafeFilename(filename)) {
            return ResponseEntity.badRequest().build();
        }

        Path file = uploadDir.resolve(filename).normalize();
        if (!file.startsWith(uploadDir) || !Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }

        String contentType = Files.probeContentType(file);
        if (contentType == null) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        InputStream inputStream = Files.newInputStream(file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .contentType(MediaType.parseMediaType(contentType))
                .body(new InputStreamResource(inputStream));
    }

    private ResponseEntity<Map<String, String>> saveUpload(MultipartFile file, String expectedKind) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }

            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith(expectedKind + "/")) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Only " + expectedKind + " files are allowed"
                ));
            }

            String extension = extensionForContentType(contentType);
            String storedName = UUID.randomUUID() + extension;
            Path destination = uploadDir.resolve(storedName).normalize();
            if (!destination.startsWith(uploadDir)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid file name"));
            }

            file.transferTo(destination);
            String url = "/api/upload/files/" + storedName;
            return ResponseEntity.ok(Map.of("url", url, "message", expectedKind + " uploaded successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload " + expectedKind + ": " + e.getMessage()));
        }
    }

    private static boolean isSafeFilename(String filename) {
        return filename != null
                && !filename.isBlank()
                && !filename.contains("..")
                && !filename.contains("/")
                && !filename.contains("\\");
    }

    private static String extensionForContentType(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/svg+xml" -> ".svg";
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            case "video/quicktime" -> ".mov";
            default -> "";
        };
    }
}
