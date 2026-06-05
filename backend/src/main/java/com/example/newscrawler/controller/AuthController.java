package com.example.newscrawler.controller;

import com.example.newscrawler.dto.LoginRequest;
import com.example.newscrawler.dto.LoginResponse;
import com.example.newscrawler.dto.SignupRequest;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.entity.VerificationCode;
import com.example.newscrawler.entity.VerificationType;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.repository.PrimitiveUserRepository;
import com.example.newscrawler.repository.VerificationCodeRepository;
import com.example.newscrawler.security.JwtTokenProvider;
import com.example.newscrawler.service.EmailService;
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
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Random;
import java.util.Set;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final int CODE_EXPIRY_MINUTES = 15;

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
    private VerificationCodeRepository verificationCodeRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final Random random = new Random();

    // Shared counter for generating synthetic primitive user IDs that don't hit the database
    private static long primitiveUserIdCounter = System.currentTimeMillis();

    @PostMapping("/limited")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse createPrimitiveUser() {
        // Use a synthetic ID that does not create a database record.
        // This prevents auto-increment ID burning on every page load/logout.
        long syntheticId = ++primitiveUserIdCounter;
        String jwtToken = jwtTokenProvider.generateTokenForPrimitiveUser(syntheticId);
        return new LoginResponse(jwtToken, null, List.of("READ_ARTICLE"));
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> signup(@Valid @RequestBody SignupRequest request) {
        if (registeredUserRepository.existsByEmail(request.email) || adminRepository.existsByEmail(request.email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }
        if (registeredUserRepository.existsByUsername(request.username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already taken");
        }

        RegisteredUser user = new RegisteredUser();
        user.setUsername(request.username);
        user.setEmail(request.email);
        user.setPassword(passwordEncoder.encode(request.password));
        user.setStatus(UserStatus.PENDING_ACTIVATION);
        user.setFullName(request.fullName);
        user.setBio(request.bio);

        Set<UserRole> roles = new HashSet<>();
        roles.add(UserRole.READ_ARTICLE);
        roles.add(UserRole.MANAGE_OWN_PROFILE);
        roles.add(UserRole.REACT_POST);
        roles.add(UserRole.LEAVE_COMMENT);
        roles.add(UserRole.REPORT_POST);
        roles.add(UserRole.CREATE_EDITOR_REQUEST);
        user.setRoles(roles);

        registeredUserRepository.save(user);

        // Send verification code
        String code = generateCode();
        verificationCodeRepository.deleteByEmail(request.email);
        VerificationCode vc = new VerificationCode(
            request.email, code, VerificationType.EMAIL_CONFIRMATION,
            Instant.now().plusSeconds(CODE_EXPIRY_MINUTES * 60)
        );
        verificationCodeRepository.save(vc);
        emailService.sendVerificationCode(request.email, code);

        return Map.of("message", "Account created. Please check your email for verification code.",
                      "email", request.email);
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse verifyEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");

        if (email == null || code == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and code are required");
        }

        VerificationCode vc = verificationCodeRepository
            .findTopByEmailAndCodeAndTypeAndUsedFalseOrderByCreatedAtDesc(email, code, VerificationType.EMAIL_CONFIRMATION)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired code"));

        if (vc.isExpired()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code has expired. Please request a new one.");
        }

        vc.setUsed(true);
        verificationCodeRepository.save(vc);

        RegisteredUser user = registeredUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setStatus(UserStatus.ACTIVE);
        registeredUserRepository.save(user);

        String jwtToken = jwtTokenProvider.generateTokenForRegisteredUser(user);
        List<String> rolesStr = user.getRoles().stream().map(Enum::name).toList();
        return new LoginResponse(jwtToken, email, rolesStr);
    }

    @PostMapping("/resend-code")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, String> resendCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        RegisteredUser user = registeredUserRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return Map.of("message", "If the account exists, a verification code has been sent.");
        }

        String code = generateCode();
        verificationCodeRepository.deleteByEmail(email);
        VerificationCode vc = new VerificationCode(
            email, code, user.getStatus() == UserStatus.PENDING_ACTIVATION 
                ? VerificationType.EMAIL_CONFIRMATION 
                : VerificationType.PASSWORD_RESET,
            Instant.now().plusSeconds(CODE_EXPIRY_MINUTES * 60)
        );
        verificationCodeRepository.save(vc);

        if (user.getStatus() == UserStatus.PENDING_ACTIVATION) {
            emailService.sendVerificationCode(email, code);
        } else {
            emailService.sendPasswordResetCode(email, code);
        }

        return Map.of("message", "If the account exists, a verification code has been sent.");
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, String> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        RegisteredUser user = registeredUserRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return Map.of("message", "If the account exists, a password reset code has been sent.");
        }

        String code = generateCode();
        verificationCodeRepository.deleteByEmail(email);
        VerificationCode vc = new VerificationCode(
            email, code, VerificationType.PASSWORD_RESET,
            Instant.now().plusSeconds(CODE_EXPIRY_MINUTES * 60)
        );
        verificationCodeRepository.save(vc);
        emailService.sendPasswordResetCode(email, code);

        return Map.of("message", "If the account exists, a password reset code has been sent.");
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, String> resetPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");
        String newPassword = body.get("newPassword");

        if (email == null || code == null || newPassword == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email, code, and newPassword are required");
        }

        if (newPassword.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        }

        VerificationCode vc = verificationCodeRepository
            .findTopByEmailAndCodeAndTypeAndUsedFalseOrderByCreatedAtDesc(email, code, VerificationType.PASSWORD_RESET)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired code"));

        if (vc.isExpired()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code has expired. Please request a new one.");
        }

        vc.setUsed(true);
        verificationCodeRepository.save(vc);

        RegisteredUser user = registeredUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setPassword(passwordEncoder.encode(newPassword));
        registeredUserRepository.save(user);

        return Map.of("message", "Password has been reset successfully.");
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        String loginId = request.getUsername();
        logger.info("Login attempt: {}", loginId);

        try {
            // Support login by email (with @) or by username
            String loginEmail = resolveEmailFromLogin(request);
            String loginIdentifier = loginEmail != null ? loginEmail : loginId;

            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginIdentifier, request.getPassword())
            );

            // Fetch user (Editor or Registered; NO Admin!)
            EditorUser editorUser = editorUserRepository.findByEmail(loginIdentifier).orElse(null);
            RegisteredUser user;
            if (editorUser != null) {
                user = editorUser;
            } else {
                user = registeredUserRepository.findByEmail(loginIdentifier)
                    .orElse(null);
                if (user == null) {
                    user = registeredUserRepository.findByUsername(loginId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
                    loginIdentifier = user.getEmail();
                }
            }

            if (user.getStatus() == UserStatus.SUSPENDED) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account suspended");
            } else if (user.getStatus() == UserStatus.PENDING_ACTIVATION) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account not verified. Please check your email for the verification code.");
            }
            
            String jwtToken = user instanceof EditorUser activeEditor
                ? jwtTokenProvider.generateTokenForEditorUser(activeEditor)
                : jwtTokenProvider.generateTokenForRegisteredUser(user);
            List<String> rolesStr = user.getRoles().stream().map(Enum::name).toList();
            return new LoginResponse(jwtToken, loginIdentifier, rolesStr);
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            logger.error("Authentication failed for {}: {}", loginId, e.getMessage(), e);
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid credentials"
            );
        }
    }

    private String resolveEmailFromLogin(LoginRequest request) {
        String username = request.getUsername();
        // If contains @, it's an email
        if (username != null && username.contains("@")) {
            return username;
        }
        // Try to find by username
        RegisteredUser user = registeredUserRepository.findByUsername(username).orElse(null);
        if (user != null) {
            return user.getEmail();
        }
        return null;
    }

    private String generateCode() {
        return String.format("%06d", random.nextInt(1000000));
    }
}