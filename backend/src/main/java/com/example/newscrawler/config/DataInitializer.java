package com.example.newscrawler.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.AllowedRole;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserType;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.AllowedRoleRepository;

import java.util.HashSet;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
public class DataInitializer {
    private static final Logger logger = LoggerFactory.getLogger(DataInitializer.class);

    @Bean
    @Order(0)
    public CommandLineRunner migrateDbCols(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                jdbcTemplate.execute("ALTER TABLE users DROP COLUMN email");
                logger.info("Successfully dropped email column from users table.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE users DROP COLUMN password");
                logger.info("Successfully dropped password column from users table.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE users DROP COLUMN username");
                logger.info("Successfully dropped username column from users table.");
            } catch (Exception e) {}

            // Migrate enum-backed role columns to VARCHAR so new permission names do not fail inserts.
            try {
                jdbcTemplate.execute("ALTER TABLE admin_roles MODIFY COLUMN role VARCHAR(100) NOT NULL");
                logger.info("Successfully migrated admin_roles.role to VARCHAR(100).");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE user_roles MODIFY COLUMN role VARCHAR(100) NOT NULL");
                logger.info("Successfully migrated user_roles.role to VARCHAR(100).");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE allowed_user_roles MODIFY COLUMN role VARCHAR(100) NOT NULL");
                logger.info("Successfully migrated allowed_user_roles.role to VARCHAR(100).");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE registered_user_roles MODIFY COLUMN role VARCHAR(100) NOT NULL");
                logger.info("Successfully migrated registered_user_roles.role to VARCHAR(100).");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE admins ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'");
                logger.info("Successfully added admins.status column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE admins ADD COLUMN profile_picture LONGTEXT");
                logger.info("Successfully added admins.profile_picture column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE roots ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'");
                logger.info("Successfully added roots.status column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE endpoints ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'");
                logger.info("Successfully added endpoints.status column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE editor_users ADD COLUMN profile_picture LONGTEXT");
                logger.info("Successfully added editor_users.profile_picture column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE editor_requests ADD COLUMN profile_picture LONGTEXT");
                logger.info("Successfully added editor_requests.profile_picture column.");
            } catch (Exception e) {}
        };
    }

    @Bean
    @Order(10)
    public CommandLineRunner initOwnerUser(
            AdminRepository adminRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.bootstrap.owner-email}") String ownerEmail,
            @Value("${app.bootstrap.owner-password}") String ownerPassword
    ) {
        return args -> {
            Admin owner = adminRepository.findByEmail(ownerEmail).orElseGet(Admin::new);
            owner.setEmail(ownerEmail);
            owner.setPassword(passwordEncoder.encode(ownerPassword));
            Set<UserRole> roles = new HashSet<>();
            roles.add(UserRole.MANAGE_USERS);
            roles.add(UserRole.VIEW_EDITOR_REQUESTS);
            roles.add(UserRole.APPROVE_EDITOR_REQUESTS);
            roles.add(UserRole.READ_ARTICLE);
            roles.add(UserRole.UPDATE_ANY_ARTICLE);
            roles.add(UserRole.DELETE_ANY_ARTICLE);
            roles.add(UserRole.CREATE_ADMIN);
            roles.add(UserRole.VIEW_EDITOR_INFO);
            roles.add(UserRole.SUSPEND_EDITOR);
            roles.add(UserRole.VIEW_CRAWLER_LOGS);
            roles.add(UserRole.CONTROL_CRAWLER);
            roles.add(UserRole.MANAGE_EVENTS);
            roles.add(UserRole.APPROVE_PUBLISH_REQUESTS);
            roles.add(UserRole.MANAGE_TELEGRAM_CHANNELS);
            roles.add(UserRole.VIEW_TELEGRAM_POSTS);
            roles.add(UserRole.CONTROL_TELEGRAM_CRAWLER);
            roles.add(UserRole.OWNER);
            owner.setRoles(roles);
            adminRepository.save(owner);
        };
    }

    @Bean
    @Order(20)
    public CommandLineRunner initCrawlerUser(
            AdminRepository adminRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.bootstrap.crawler-email:crawler-service@news.local}") String crawlerEmail,
            @Value("${app.bootstrap.crawler-password:secure-crawler-password-change-me}") String crawlerPassword
    ) {
        return args -> {
            Admin crawler = adminRepository.findByEmail(crawlerEmail).orElseGet(Admin::new);
            crawler.setEmail(crawlerEmail);
            crawler.setPassword(passwordEncoder.encode(crawlerPassword));
            Set<UserRole> roles = new HashSet<>();
            roles.add(UserRole.WRITE_SYSTEM_ARTICLE);
            roles.add(UserRole.READ_SYSTEM_METADATA);
            crawler.setRoles(roles);
            adminRepository.save(crawler);
        };
    }

    @Bean
    @Order(25)
    public CommandLineRunner initTelegramCrawlerUser(
            AdminRepository adminRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.bootstrap.telegram-crawler-email:telegram-crawler@news.local}") String tcEmail,
            @Value("${app.bootstrap.telegram-crawler-password:secure-telegram-password-change-me}") String tcPassword
    ) {
        return args -> {
            Admin tc = adminRepository.findByEmail(tcEmail).orElseGet(Admin::new);
            tc.setEmail(tcEmail);
            tc.setPassword(passwordEncoder.encode(tcPassword));
            Set<UserRole> roles = new HashSet<>();
            roles.add(UserRole.WRITE_TELEGRAM_POSTS);
            roles.add(UserRole.READ_SYSTEM_METADATA);
            tc.setRoles(roles);
            adminRepository.save(tc);
        };
    }

    @Bean
    @Order(30)
    public CommandLineRunner initAllowedRoles(AllowedRoleRepository allowedRoleRepository) {
        return args -> {
            // Admin roles
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.MANAGE_USERS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.VIEW_EDITOR_REQUESTS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.APPROVE_EDITOR_REQUESTS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.VIEW_EDITOR_INFO);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.SUSPEND_EDITOR);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.UPDATE_ANY_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.DELETE_ANY_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.CREATE_ADMIN);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.READ_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.VIEW_CRAWLER_LOGS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.CONTROL_CRAWLER);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.MANAGE_EVENTS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.APPROVE_PUBLISH_REQUESTS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.MANAGE_TELEGRAM_CHANNELS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.VIEW_TELEGRAM_POSTS);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.CONTROL_TELEGRAM_CRAWLER);
            ensureAllowedRole(allowedRoleRepository, UserType.ADMIN, UserRole.OWNER);

            // Editor roles
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.PUBLISH_LIVE_NEWS);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.EDIT_LIVE_NEWS);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.DELETE_LIVE_NEWS);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.READ_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.MANAGE_OWN_PROFILE);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.REACT_POST);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.LEAVE_COMMENT);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.REPORT_POST);

            // Registered roles
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.READ_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.MANAGE_OWN_PROFILE);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.REACT_POST);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.LEAVE_COMMENT);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.REPORT_POST);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.CREATE_EDITOR_REQUEST);

            // Primitive roles
            ensureAllowedRole(allowedRoleRepository, UserType.PRIMITIVE, UserRole.READ_ARTICLE);
        };
    }

    private void ensureAllowedRole(AllowedRoleRepository repository, UserType userType, UserRole role) {
        if (!repository.existsByUserTypeAndRole(userType, role)) {
            repository.save(new AllowedRole(userType, role));
        }
    }
}



