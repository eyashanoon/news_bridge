package com.example.newscrawler.config;

import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final RegisteredUserRepository registeredUserRepository;
    private final EditorUserRepository editorUserRepository;
    private final AdminRepository adminRepository;

    public CustomUserDetailsService(RegisteredUserRepository registeredUserRepository,
                                    EditorUserRepository editorUserRepository,
                                    AdminRepository adminRepository) {
        this.registeredUserRepository = registeredUserRepository;
        this.editorUserRepository = editorUserRepository;
        this.adminRepository = adminRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Try admin by email first
        Admin admin = adminRepository.findByEmail(username).orElse(null);
        if (admin != null) {
            return User.builder()
                    .username(admin.getEmail())
                    .password(admin.getPassword())
                    .roles(admin.getRoles().stream().map(Enum::name).toArray(String[]::new))
                    .build();
        }

        // Try editor user by email (must be checked before registered user since
        // the registered user's email may have been modified when the editor was created)
        EditorUser editor = editorUserRepository.findByEmail(username).orElse(null);
        if (editor != null) {
            return User.builder()
                    .username(editor.getEmail())
                    .password(editor.getPassword())
                    .roles(editor.getRoles().stream().map(Enum::name).toArray(String[]::new))
                    .build();
        }

        // Try registered user by email
        RegisteredUser user = registeredUserRepository.findByEmail(username).orElse(null);
        if (user != null) {
            return User.builder()
                    .username(user.getEmail())
                    .password(user.getPassword())
                    .roles(user.getRoles().stream().map(Enum::name).toArray(String[]::new))
                    .build();
        }

        // Try registered user by username
        user = registeredUserRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .roles(user.getRoles().stream().map(Enum::name).toArray(String[]::new))
                .build();
    }
}