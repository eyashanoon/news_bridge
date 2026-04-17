package com.example.newscrawler.controller;

import com.example.newscrawler.dto.DashboardStatsResponse;
import com.example.newscrawler.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardController {

    @Autowired
    private ArticleRepository articleRepository;

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private EditorRequestRepository editorRequestRepository;

    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public DashboardStatsResponse getStats() {
        DashboardStatsResponse stats = new DashboardStatsResponse();
        stats.totalArticles = articleRepository.count();
        stats.totalRegisteredUsers = registeredUserRepository.count();
        stats.totalEditors = editorUserRepository.count();
        stats.totalAdmins = adminRepository.count();
        stats.pendingEditorRequests = editorRequestRepository.countByStatus("PENDING");
        return stats;
    }
}
