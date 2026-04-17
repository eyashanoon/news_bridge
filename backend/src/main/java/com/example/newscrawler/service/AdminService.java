package com.example.newscrawler.service;

import com.example.newscrawler.dto.CreateAdminRequest;
import com.example.newscrawler.dto.AdminResponse;
import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.entity.UserType;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.AllowedRoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.List;

@Service
public class AdminService {

    private static final String DEFAULT_ADMIN_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='100%25' height='100%25' fill='%230f172a'/><circle cx='80' cy='58' r='28' fill='%2338bdf8'/><rect x='28' y='96' width='104' height='44' rx='22' fill='%232563eb'/></svg>";

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private AllowedRoleRepository allowedRoleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public AdminResponse createAdmin(CreateAdminRequest request) {
        if (adminRepository.existsByEmail(request.email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }

        Admin admin = new Admin();
        admin.setEmail(request.email);
        admin.setPassword(passwordEncoder.encode(request.password));
        admin.setStatus(UserStatus.ACTIVE);
        admin.setProfilePicture((request.profilePicture == null || request.profilePicture.isBlank())
            ? DEFAULT_ADMIN_AVATAR
            : request.profilePicture);

        Set<UserRole> userRoles = new HashSet<>();
        if (request.roles != null) {
            for (String roleStr : request.roles) {
                try {
                    UserRole role = UserRole.valueOf(roleStr);
                    if (!allowedRoleRepository.existsByUserTypeAndRole(UserType.ADMIN, role)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role not allowed for Admin: " + roleStr);
                    }
                    userRoles.add(role);
                } catch (IllegalArgumentException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role: " + roleStr);
                }
            }
        }
        admin.setRoles(userRoles);

        admin = adminRepository.save(admin);
        return mapToDto(admin);
    }
    
    public AdminResponse updateAdminRoles(Long id, List<String> roles) {
        Admin admin = adminRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        Set<UserRole> userRoles = new HashSet<>();
        if (roles != null) {
            for (String roleStr : roles) {
                try {
                    UserRole role = UserRole.valueOf(roleStr);
                    if (!allowedRoleRepository.existsByUserTypeAndRole(UserType.ADMIN, role)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role not allowed for Admin: " + roleStr);
                    }
                    userRoles.add(role);
                } catch (IllegalArgumentException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role: " + roleStr);
                }
            }
        }
        admin.setRoles(userRoles);
        return mapToDto(adminRepository.save(admin));
    }

    public AdminResponse getAdminById(Long id) {
        return mapToDto(adminRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found")));
    }

    public AdminResponse getAdminByEmail(String email) {
        return mapToDto(adminRepository.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found")));
    }

    public AdminResponse updateAdminStatus(Long id, String status) {
        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        UserStatus parsed;
        try {
            parsed = UserStatus.valueOf(status);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
        admin.setStatus(parsed);
        return mapToDto(adminRepository.save(admin));
    }

    public List<AdminResponse> listAllAdmins() {
        return adminRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public void deleteAdmin(Long id) {
        Admin admin = adminRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        adminRepository.delete(admin);
    }

    public AdminResponse updateAdminName(Long id, String email) {
        Admin admin = adminRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        if (!admin.getEmail().equals(email) && adminRepository.existsByEmail(email)) {
             throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }
        admin.setEmail(email);
        return mapToDto(adminRepository.save(admin));
    }

    private AdminResponse mapToDto(Admin admin) {
        AdminResponse response = new AdminResponse();
        response.id = admin.getId();
        response.email = admin.getEmail();
        response.profilePicture = admin.getProfilePicture();
        response.status = admin.getStatus() == null ? null : admin.getStatus().name();
        response.active = admin.getStatus() == UserStatus.ACTIVE;
        response.roles = admin.getRoles().stream().map(Enum::name).collect(Collectors.toSet());
        return response;
    }
}
