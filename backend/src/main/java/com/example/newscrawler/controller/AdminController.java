package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CreateAdminRequest;
import com.example.newscrawler.dto.AdminResponse;
import com.example.newscrawler.dto.UpdateAdminNameRequest;
import com.example.newscrawler.dto.UpdateAdminRolesRequest;
import com.example.newscrawler.dto.UpdateUserStatusRequest;
import com.example.newscrawler.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/users")
    @PreAuthorize("hasRole('CREATE_ADMIN') or hasRole('MANAGE_USERS')")
    public List<AdminResponse> listAdmins() {
        return adminService.listAllAdmins();
    }

    @PostMapping("/users")
    @PreAuthorize("hasRole('CREATE_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminResponse createAdmin(@Valid @RequestBody CreateAdminRequest request) {
        return adminService.createAdmin(request);
    }

    @PutMapping("/users/{id}/roles")
    @PreAuthorize("hasRole('CREATE_ADMIN') or hasRole('MANAGE_USERS')")
    public AdminResponse updateAdminRoles(@PathVariable Long id, @RequestBody UpdateAdminRolesRequest request) {
        return adminService.updateAdminRoles(id, request.roles);
    }

    @PutMapping("/users/{id}/name")
    @PreAuthorize("hasRole('CREATE_ADMIN') or hasRole('MANAGE_USERS')")
    public AdminResponse updateAdminName(@PathVariable Long id, @RequestBody UpdateAdminNameRequest request) {
        return adminService.updateAdminName(id, request.email);
    }

    @PutMapping("/users/{id}/status")
    @PreAuthorize("hasRole('CREATE_ADMIN') or hasRole('MANAGE_USERS')")
    public AdminResponse updateAdminStatus(@PathVariable Long id, @RequestBody UpdateUserStatusRequest request) {
        return adminService.updateAdminStatus(id, request.status);
    }

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasRole('CREATE_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAdmin(@PathVariable Long id) {
        adminService.deleteAdmin(id);
    }

    @GetMapping("/me")
    public AdminResponse getMe() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return adminService.getAdminByEmail(email);
    }

    @PutMapping("/me")
    public AdminResponse updateMyName(@RequestBody UpdateAdminNameRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        AdminResponse admin = adminService.getAdminByEmail(email);
        return adminService.updateAdminName(admin.id, request.email);
    }
}
