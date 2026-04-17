package com.example.newscrawler.config;

import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.RegisteredUser;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final RegisteredUserRepository registeredUserRepository;
    private final AdminRepository adminRepository;

    public CustomUserDetailsService(RegisteredUserRepository registeredUserRepository, AdminRepository adminRepository) {
        this.registeredUserRepository = registeredUserRepository;
        this.adminRepository = adminRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Admin admin = adminRepository.findByEmail(username).orElse(null);
        if (admin != null) {
            return User.builder()
                    .username(admin.getEmail())
                    .password(admin.getPassword())
                    .roles(admin.getRoles().stream().map(Enum::name).toArray(String[]::new))
                    .build();
        }

        RegisteredUser user = registeredUserRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .roles(user.getRoles().stream().map(Enum::name).toArray(String[]::new))
                .build();
    }
}
