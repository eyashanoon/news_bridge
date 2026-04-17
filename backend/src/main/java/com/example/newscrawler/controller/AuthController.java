package com.example.newscrawler.controller;

import com.example.newscrawler.dto.LoginRequest;
import com.example.newscrawler.dto.LoginResponse;
import com.example.newscrawler.dto.SignupRequest;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.repository.PrimitiveUserRepository;
import com.example.newscrawler.security.JwtTokenProvider;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private PrimitiveUserRepository primitiveUserRepository;

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/limited")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse createPrimitiveUser() {
        PrimitiveUser user = new PrimitiveUser();
        primitiveUserRepository.save(user);
        String jwtToken = jwtTokenProvider.generateTokenForPrimitiveUser(user);
        return new LoginResponse(jwtToken, null, List.of("READ_ARTICLE"));
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse signup(@Valid @RequestBody SignupRequest request) {
        if (registeredUserRepository.existsByEmail(request.email) || adminRepository.existsByEmail(request.email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }

        RegisteredUser user = new RegisteredUser();
        user.setUsername(request.username);
        user.setEmail(request.email);
        user.setPassword(passwordEncoder.encode(request.password));
        user.setStatus(UserStatus.ACTIVE);

        Set<UserRole> roles = new HashSet<>();
        roles.add(UserRole.READ_ARTICLE);
        roles.add(UserRole.MANAGE_OWN_PROFILE);
        roles.add(UserRole.REACT_POST);
        roles.add(UserRole.LEAVE_COMMENT);
        roles.add(UserRole.REPORT_POST);
        roles.add(UserRole.CREATE_EDITOR_REQUEST);
        user.setRoles(roles);

        registeredUserRepository.save(user);

        String jwtToken = jwtTokenProvider.generateTokenForRegisteredUser(user);
        return new LoginResponse(jwtToken, request.email, List.of("REGISTERED"));
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        logger.info("User Login attempt for email: {}", request.email());

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );

            // Fetch user (Editor or Registered; NO Admin!)
            EditorUser editorUser = editorUserRepository.findByEmail(request.email()).orElse(null);
            RegisteredUser user = editorUser != null
                ? editorUser
                : registeredUserRepository.findByEmail(request.email())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            if (user.getStatus() == UserStatus.SUSPENDED) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account suspended");
            } else if (user.getStatus() == UserStatus.PENDING_ACTIVATION) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account pending activation");
            }
            
            String jwtToken = user instanceof EditorUser activeEditor
                ? jwtTokenProvider.generateTokenForEditorUser(activeEditor)
                : jwtTokenProvider.generateTokenForRegisteredUser(user);
            List<String> rolesStr = user.getRoles().stream().map(Enum::name).toList();
            return new LoginResponse(jwtToken, request.email(), rolesStr);
        } catch (Exception e) {
            logger.error("Authentication failed for {}: {}", request.email(), e.getMessage(), e);
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid credentials"
            );
        }
    }
}
