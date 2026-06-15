package com.example.newscrawler.controller;

import com.example.newscrawler.dto.LoginRequest;
import com.example.newscrawler.dto.LoginResponse;
import com.example.newscrawler.dto.SignupRequest;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.LoginDevice;
import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.entity.VerificationCode;
import com.example.newscrawler.entity.VerificationType;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LoginDeviceRepository;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final int CODE_EXPIRY_MINUTES = 15;

    // Password strength requirements
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final Pattern HAS_UPPERCASE = Pattern.compile("[A-Z]");
    private static final Pattern HAS_LOWERCASE = Pattern.compile("[a-z]");
    private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");
    private static final Pattern HAS_SPECIAL = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]");

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
    private LoginDeviceRepository loginDeviceRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final Random random = new Random();

    @PostMapping("/limited")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse createPrimitiveUser() {
        PrimitiveUser user = new PrimitiveUser();
        user = primitiveUserRepository.save(user);
        String jwtToken = jwtTokenProvider.generateTokenForPrimitiveUser(user);
        return new LoginResponse(jwtToken, null, List.of("READ_ARTICLE"));
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, String> signup(@Valid @RequestBody SignupRequest request) {
        // Validate password strength
        String passwordError = validatePasswordStrength(request.password);
        if (passwordError != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, passwordError);
        }

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
    public Map<String, String> verifyEmail(@RequestBody Map<String, String> body) {
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

        return Map.of("message", "Email verified successfully! You can now log in with your credentials.");
    }

    @PostMapping("/resend-code")
    @ResponseStatus(HttpStatus.OK)
    @Transactional
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
    @Transactional
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

        // Validate new password strength
        String passwordError = validatePasswordStrength(newPassword);
        if (passwordError != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, passwordError);
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

    @PostMapping("/check-password-strength")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> checkPasswordStrength(@RequestBody Map<String, String> body) {
        String password = body.get("password");
        if (password == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required");
        }

        return evaluatePasswordStrength(password);
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    @Transactional
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        String loginId = request.getUsername();
        String deviceFingerprint = request.getDeviceFingerprint();
        String deviceLabel = request.getDeviceLabel();
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
            
            // MFA: Check if device is recognized
            boolean isRecognizedDevice = false;
            if (deviceFingerprint != null && !deviceFingerprint.isBlank()) {
                isRecognizedDevice = loginDeviceRepository.existsByUserIdAndDeviceFingerprint(
                    user.getId(), deviceFingerprint);
            }

            if (isRecognizedDevice) {
                // Recognized device - update last seen and proceed with login
                loginDeviceRepository.findByUserIdAndDeviceFingerprint(user.getId(), deviceFingerprint)
                    .ifPresent(device -> {
                        device.setLastSeenAt(Instant.now());
                        loginDeviceRepository.save(device);
                    });

                String jwtToken = user instanceof EditorUser activeEditor
                    ? jwtTokenProvider.generateTokenForEditorUser(activeEditor)
                    : jwtTokenProvider.generateTokenForRegisteredUser(user);
                List<String> rolesStr = user.getRoles().stream().map(Enum::name).toList();
                
                Map<String, Object> response = new HashMap<>();
                response.put("token", jwtToken);
                response.put("email", loginIdentifier);
                response.put("roles", rolesStr);
                return response;
            } else {
                // New device - require MFA
                // Send MFA code to email
                String code = generateCode();
                verificationCodeRepository.deleteByEmail(loginIdentifier);
                VerificationCode vc = new VerificationCode(
                    loginIdentifier, code, VerificationType.MFA_LOGIN,
                    Instant.now().plusSeconds(CODE_EXPIRY_MINUTES * 60)
                );
                verificationCodeRepository.save(vc);
                emailService.sendMfaCode(loginIdentifier, code);

                // Store login attempt info in a temporary way - 
                // we'll verify and trust the device after MFA completes
                Map<String, Object> response = new HashMap<>();
                response.put("requireMfa", true);
                response.put("email", loginIdentifier);
                response.put("deviceFingerprint", deviceFingerprint);
                response.put("deviceLabel", deviceLabel);
                response.put("message", "A verification code has been sent to your email for new device confirmation.");
                return response;
            }
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

    @PostMapping("/verify-mfa")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse verifyMfa(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");
        String deviceFingerprint = body.get("deviceFingerprint");
        String deviceLabel = body.get("deviceLabel");

        if (email == null || code == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and code are required");
        }

        VerificationCode vc = verificationCodeRepository
            .findTopByEmailAndCodeAndTypeAndUsedFalseOrderByCreatedAtDesc(email, code, VerificationType.MFA_LOGIN)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired code"));

        if (vc.isExpired()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code has expired. Please request a new one.");
        }

        vc.setUsed(true);
        verificationCodeRepository.save(vc);

        // Find the user
        RegisteredUser user = registeredUserRepository.findByEmail(email)
            .orElse(null);
        if (user == null) {
            EditorUser editor = editorUserRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            
            // For editor users, just generate token
            String jwtToken = jwtTokenProvider.generateTokenForEditorUser(editor);
            List<String> rolesStr = editor.getRoles().stream().map(Enum::name).toList();
            
            // Trust the device if fingerprint provided
            if (deviceFingerprint != null && !deviceFingerprint.isBlank()) {
                String label = deviceLabel != null && !deviceLabel.isBlank() ? deviceLabel : "Unknown device";
                LoginDevice dev = new LoginDevice(editor.getId(), deviceFingerprint, label);
                loginDeviceRepository.save(dev);
            }
            
            return new LoginResponse(jwtToken, email, rolesStr);
        }

        // Generate token for registered user
        String jwtToken = jwtTokenProvider.generateTokenForRegisteredUser(user);
        List<String> rolesStr = user.getRoles().stream().map(Enum::name).toList();

        // Trust the device if fingerprint provided
        if (deviceFingerprint != null && !deviceFingerprint.isBlank()) {
            String label = deviceLabel != null && !deviceLabel.isBlank() ? deviceLabel : "Unknown device";
            // Check if already exists (race condition)
            if (!loginDeviceRepository.existsByUserIdAndDeviceFingerprint(user.getId(), deviceFingerprint)) {
                LoginDevice dev = new LoginDevice(user.getId(), deviceFingerprint, label);
                loginDeviceRepository.save(dev);
            }
        }

        return new LoginResponse(jwtToken, email, rolesStr);
    }

    @PostMapping("/resend-mfa")
    @ResponseStatus(HttpStatus.OK)
    @Transactional
    public Map<String, String> resendMfa(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        String code = generateCode();
        verificationCodeRepository.deleteByEmail(email);
        VerificationCode vc = new VerificationCode(
            email, code, VerificationType.MFA_LOGIN,
            Instant.now().plusSeconds(CODE_EXPIRY_MINUTES * 60)
        );
        verificationCodeRepository.save(vc);
        emailService.sendMfaCode(email, code);

        return Map.of("message", "A new verification code has been sent to your email.");
    }

    private Map<String, Object> evaluatePasswordStrength(String password) {
        Map<String, Object> result = new HashMap<>();
        
        boolean hasMinLength = password.length() >= MIN_PASSWORD_LENGTH;
        boolean hasUpper = HAS_UPPERCASE.matcher(password).find();
        boolean hasLower = HAS_LOWERCASE.matcher(password).find();
        boolean hasDigit = HAS_DIGIT.matcher(password).find();
        boolean hasSpecial = HAS_SPECIAL.matcher(password).find();

        result.put("hasMinLength", hasMinLength);
        result.put("hasUppercase", hasUpper);
        result.put("hasLowercase", hasLower);
        result.put("hasDigit", hasDigit);
        result.put("hasSpecial", hasSpecial);
        result.put("minLength", MIN_PASSWORD_LENGTH);

        // Calculate strength score (0-100)
        int score = 0;
        // Length contribution (up to 40 points)
        score += Math.min(40, password.length() * 2);
        if (hasUpper) score += 10;
        if (hasLower) score += 10;
        if (hasDigit) score += 15;
        if (hasSpecial) score += 25;

        score = Math.min(100, score);

        String strength;
        if (score < 40) {
            strength = "weak";
        } else if (score < 70) {
            strength = "medium";
        } else {
            strength = "strong";
        }

        String error = null;
        List<String> missing = new java.util.ArrayList<>();
        if (!hasMinLength) missing.add("At least " + MIN_PASSWORD_LENGTH + " characters");
        if (!hasUpper) missing.add("One uppercase letter");
        if (!hasLower) missing.add("One lowercase letter");
        if (!hasDigit) missing.add("One digit");
        if (!hasSpecial) missing.add("One special character");

        result.put("score", score);
        result.put("strength", strength);
        result.put("missing", missing);

        return result;
    }

    private String validatePasswordStrength(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            return "Password must be at least " + MIN_PASSWORD_LENGTH + " characters";
        }
        
        List<String> missing = new java.util.ArrayList<>();
        if (!HAS_UPPERCASE.matcher(password).find()) {
            missing.add("an uppercase letter");
        }
        if (!HAS_LOWERCASE.matcher(password).find()) {
            missing.add("a lowercase letter");
        }
        if (!HAS_DIGIT.matcher(password).find()) {
            missing.add("a digit");
        }
        if (!HAS_SPECIAL.matcher(password).find()) {
            missing.add("a special character");
        }

        if (!missing.isEmpty()) {
            return "Password must contain " + String.join(", ", missing);
        }

        return null;
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