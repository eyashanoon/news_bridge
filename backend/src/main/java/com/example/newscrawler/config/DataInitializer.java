package com.example.newscrawler.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;

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
            // Add new profile columns to registered_users
            try {
                jdbcTemplate.execute("ALTER TABLE registered_users ADD COLUMN full_name VARCHAR(255)");
                logger.info("Successfully added registered_users.full_name column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE registered_users ADD COLUMN bio TEXT");
                logger.info("Successfully added registered_users.bio column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE registered_users ADD COLUMN date_of_birth DATE");
                logger.info("Successfully added registered_users.date_of_birth column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE registered_users ADD COLUMN `location` VARCHAR(255)");
                logger.info("Successfully added registered_users.location column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE registered_users ADD COLUMN profile_picture LONGTEXT");
                logger.info("Successfully added registered_users.profile_picture column.");
            } catch (Exception e) {}
            try {
                jdbcTemplate.execute("ALTER TABLE registered_users ADD UNIQUE INDEX UK_username (username)");
                logger.info("Successfully added unique index on registered_users.username.");
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

            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.PUBLISH_LIVE_NEWS);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.EDIT_LIVE_NEWS);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.DELETE_LIVE_NEWS);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.READ_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.MANAGE_OWN_PROFILE);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.REACT_POST);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.LEAVE_COMMENT);
            ensureAllowedRole(allowedRoleRepository, UserType.EDITOR, UserRole.REPORT_POST);

            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.READ_ARTICLE);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.MANAGE_OWN_PROFILE);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.REACT_POST);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.LEAVE_COMMENT);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.REPORT_POST);
            ensureAllowedRole(allowedRoleRepository, UserType.REGISTERED, UserRole.CREATE_EDITOR_REQUEST);

            ensureAllowedRole(allowedRoleRepository, UserType.PRIMITIVE, UserRole.READ_ARTICLE);
        };
    }

    @Bean
    @Order(5)
    public CommandLineRunner cleanupOldAccounts(
            PrimitiveUserRepository primitiveUserRepository,
            RegisteredUserRepository registeredUserRepository,
            EditorUserRepository editorUserRepository,
            JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                // Delete primitive user references in dependent tables first, then delete the users
                jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
                
                // Get all primitive user IDs first
                var ids = jdbcTemplate.queryForList(
                    "SELECT u.id FROM users u JOIN primitive_users p ON u.id = p.id", Long.class);
                
                if (!ids.isEmpty()) {
                    // Delete associated comments
                    for (Long id : ids) {
                        jdbcTemplate.update("DELETE FROM comments WHERE user_id = ?", id);
                        jdbcTemplate.update("DELETE FROM post_reactions WHERE user_id = ?", id);
                        jdbcTemplate.update("DELETE FROM post_interactions WHERE user_id = ?", id);
                        jdbcTemplate.update("DELETE FROM user_preferences WHERE user_id = ?", id);
                        jdbcTemplate.update("DELETE FROM comment_votes WHERE user_id = ?", id);
                    }
                    
                    // Delete the primitive users
                    primitiveUserRepository.deleteAll();
                    logger.info("Cleared {} primitive (guest) user accounts.", ids.size());
                } else {
                    logger.info("No primitive user accounts to clear.");
                }
                
                jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
            } catch (Exception e) {
                logger.warn("Could not fully clear primitive users: {}", e.getMessage());
                // Ensure FK checks are re-enabled
                try { jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1"); } catch (Exception ex) {}
            }
            
            logger.info("Old user accounts cleanup complete.");
        };
    }

    @Bean
    @Order(35)
    public CommandLineRunner initHierarchicalFields(CategoryFieldRepository categoryFieldRepository) {
        return args -> {
            // Helper function: find existing field by name or create new
            java.util.function.BiFunction<CategoryFieldRepository, String, java.util.Optional<CategoryField>> findExisting = (repo, name) -> {
                return repo.findAll().stream().filter(f -> f.getName().equals(name)).findFirst();
            };

            java.util.function.Function<String, java.util.Optional<CategoryField>> findField = (name) -> 
                findExisting.apply(categoryFieldRepository, name);

            // Always run seeding to fix any orphaned sub-fields (fields existing without a parent)
            // The createSubField method will update parent references for existing orphaned records.

            // Get or create general categories
            CategoryField sports = findField.apply("Sports")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Sports", "Sporting events, competitions, and athletic activities"));
            CategoryField politics = findField.apply("Politics")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Politics", "Political events, governance, and policy"));
            CategoryField technology = findField.apply("Technology")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Technology", "Tech innovations, digital trends, and software"));
            CategoryField health = findField.apply("Health")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Health", "Medical, health, and wellness topics"));
            CategoryField business = findField.apply("Business")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Business", "Markets, finance, and commerce"));
            CategoryField entertainment = findField.apply("Entertainment")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Entertainment", "Media, arts, and pop culture"));
            CategoryField environment = findField.apply("Environment")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Environment", "Climate, nature, and ecological issues"));
            CategoryField education = findField.apply("Education")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Education", "Learning, academia, and educational policy"));

            // NEW general categories
            CategoryField science = findField.apply("Science & Space")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Science & Space", "Scientific discoveries, space exploration, and research"));
            CategoryField military = findField.apply("Military & Defense")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Military & Defense", "Defense, armed forces, and security"));
            CategoryField law = findField.apply("Law & Justice")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Law & Justice", "Legal matters, courts, and justice system"));
            CategoryField culture = findField.apply("Culture & Society")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Culture & Society", "Social issues, traditions, and cultural movements"));
            CategoryField travel = findField.apply("Travel & Tourism")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Travel & Tourism", "Travel destinations, hospitality, and tourism industry"));
            CategoryField food = findField.apply("Food & Cuisine")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Food & Cuisine", "Cooking, restaurants, and food culture"));
            CategoryField religion = findField.apply("Religion & Spirituality")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Religion & Spirituality", "Faith, religious events, and spiritual topics"));
            CategoryField automotive = findField.apply("Automotive")
                .orElseGet(() -> createGeneralField(categoryFieldRepository, "Automotive", "Cars, vehicles, and transportation industry"));

            // Specific sub-fields under Sports (10)
            createSubField(categoryFieldRepository, "Football", "Football (soccer) leagues, matches, and tournaments", sports);
            createSubField(categoryFieldRepository, "Basketball", "Basketball leagues and events", sports);
            createSubField(categoryFieldRepository, "Tennis", "Tennis tournaments and player news", sports);
            createSubField(categoryFieldRepository, "Mixed Martial Arts", "UFC and combat sports events", sports);
            createSubField(categoryFieldRepository, "Olympics", "Olympic games and international competitions", sports);
            createSubField(categoryFieldRepository, "Cricket", "Cricket matches, leagues, and tournaments", sports);
            createSubField(categoryFieldRepository, "Formula 1 & Motorsports", "Racing, F1, MotoGP, and rally events", sports);
            createSubField(categoryFieldRepository, "American Football", "NFL and college football coverage", sports);
            createSubField(categoryFieldRepository, "Baseball", "MLB and international baseball", sports);
            createSubField(categoryFieldRepository, "Boxing", "Professional boxing matches and news", sports);

            // Specific sub-fields under Politics (8)
            createSubField(categoryFieldRepository, "Local Politics", "Local government and municipal issues", politics);
            createSubField(categoryFieldRepository, "International Relations", "Diplomacy and foreign affairs", politics);
            createSubField(categoryFieldRepository, "Elections & Voting", "Election campaigns and voting processes", politics);
            createSubField(categoryFieldRepository, "Geopolitical Conflicts", "Wars, conflicts, and geopolitical tensions", politics);
            createSubField(categoryFieldRepository, "Immigration Policy", "Border control, asylum, and migration", politics);
            createSubField(categoryFieldRepository, "Legislation & Parliament", "New laws, parliamentary debates, and governance", politics);
            createSubField(categoryFieldRepository, "Human Rights", "Civil liberties, equality, and social justice", politics);
            createSubField(categoryFieldRepository, "Political Scandals", "Corruption, controversies, and investigations", politics);

            // Specific sub-fields under Technology (10)
            createSubField(categoryFieldRepository, "Artificial Intelligence", "AI research, products, and impacts", technology);
            createSubField(categoryFieldRepository, "Cybersecurity", "Security threats, breaches, and protections", technology);
            createSubField(categoryFieldRepository, "Software Development", "Programming, tools, and developer ecosystem", technology);
            createSubField(categoryFieldRepository, "Consumer Electronics", "Smartphones, gadgets, and tech hardware", technology);
            createSubField(categoryFieldRepository, "Social Media", "Platforms, trends, and social networking", technology);
            createSubField(categoryFieldRepository, "Cloud Computing", "Cloud services, infrastructure, and SaaS", technology);
            createSubField(categoryFieldRepository, "Blockchain & Crypto", "Cryptocurrency, blockchain tech, and Web3", technology);
            createSubField(categoryFieldRepository, "Robotics", "Robots, automation, and drones", technology);
            createSubField(categoryFieldRepository, "E-Commerce", "Online shopping, marketplaces, and digital payments", technology);
            createSubField(categoryFieldRepository, "Telecommunications", "5G, networks, and communication tech", technology);

            // Specific sub-fields under Health & Medicine (8)
            createSubField(categoryFieldRepository, "Public Health", "Health policy and community health", health);
            createSubField(categoryFieldRepository, "Medical Research", "Scientific medical discoveries and trials", health);
            createSubField(categoryFieldRepository, "Nutrition & Fitness", "Diet, exercise, and wellness trends", health);
            createSubField(categoryFieldRepository, "Mental Health", "Mental wellness and psychological health", health);
            createSubField(categoryFieldRepository, "Pharmaceuticals", "Drug development, approvals, and recalls", health);
            createSubField(categoryFieldRepository, "Pandemics & Outbreaks", "Disease outbreaks and epidemic tracking", health);
            createSubField(categoryFieldRepository, "Hospital & Healthcare", "Hospital systems and healthcare delivery", health);
            createSubField(categoryFieldRepository, "Alternative Medicine", "Holistic, traditional, and integrative medicine", health);

            // Specific sub-fields under Business & Finance (10)
            createSubField(categoryFieldRepository, "Stock Markets", "Stock exchange movements and trading", business);
            createSubField(categoryFieldRepository, "Startups & Entrepreneurship", "New ventures and business innovation", business);
            createSubField(categoryFieldRepository, "Global Trade", "International trade and tariffs", business);
            createSubField(categoryFieldRepository, "Banking & Finance", "Banking, interest rates, and financial services", business);
            createSubField(categoryFieldRepository, "Real Estate", "Property markets, housing, and construction", business);
            createSubField(categoryFieldRepository, "Cryptocurrency Markets", "Bitcoin, altcoins, and digital asset trading", business);
            createSubField(categoryFieldRepository, "Mergers & Acquisitions", "Corporate deals, buyouts, and consolidation", business);
            createSubField(categoryFieldRepository, "Labor & Employment", "Jobs, wages, unions, and workplace trends", business);
            createSubField(categoryFieldRepository, "Energy Markets", "Oil, gas, electricity, and commodity prices", business);
            createSubField(categoryFieldRepository, "E-Commerce & Retail", "Online and brick-and-mortar retail industry", business);

            // Specific sub-fields under Entertainment (8)
            createSubField(categoryFieldRepository, "Movies & TV", "Film, television, and streaming", entertainment);
            createSubField(categoryFieldRepository, "Music", "Music releases, concerts, and industry news", entertainment);
            createSubField(categoryFieldRepository, "Gaming", "Video games, esports, and gaming culture", entertainment);
            createSubField(categoryFieldRepository, "Celebrity News", "Celebrity updates and pop culture", entertainment);
            createSubField(categoryFieldRepository, "Anime & Manga", "Japanese animation, comics, and otaku culture", entertainment);
            createSubField(categoryFieldRepository, "Theater & Performing Arts", "Stage shows, ballet, and live performances", entertainment);
            createSubField(categoryFieldRepository, "Streaming Platforms", "Netflix, YouTube, Twitch, and content creators", entertainment);
            createSubField(categoryFieldRepository, "Books & Literature", "Publishing, authors, and literary events", entertainment);

            // Specific sub-fields under Environment & Nature (8)
            createSubField(categoryFieldRepository, "Climate Change", "Climate science and policy", environment);
            createSubField(categoryFieldRepository, "Natural Disasters", "Earthquakes, hurricanes, floods, and wildfires", environment);
            createSubField(categoryFieldRepository, "Conservation", "Wildlife protection and environmental conservation", environment);
            createSubField(categoryFieldRepository, "Renewable Energy", "Solar, wind, and sustainable energy", environment);
            createSubField(categoryFieldRepository, "Pollution", "Air, water, and plastic pollution issues", environment);
            createSubField(categoryFieldRepository, "Agriculture & Farming", "Farming, crops, and food production", environment);
            createSubField(categoryFieldRepository, "Water & Oceans", "Marine life, ocean health, and water resources", environment);
            createSubField(categoryFieldRepository, "Deforestation & Land Use", "Forests, land management, and desertification", environment);

            // Specific sub-fields under Education (6)
            createSubField(categoryFieldRepository, "Higher Education", "Universities, colleges, and academia", education);
            createSubField(categoryFieldRepository, "EdTech", "Educational technology and online learning", education);
            createSubField(categoryFieldRepository, "Educational Policy", "School reform and education legislation", education);
            createSubField(categoryFieldRepository, "K-12 Education", "Primary and secondary schooling", education);
            createSubField(categoryFieldRepository, "Student Life", "Campus news, student activism, and scholarships", education);
            createSubField(categoryFieldRepository, "Vocational Training", "Trade schools, apprenticeships, and skills training", education);

            // Specific sub-fields under Science & Space (8)
            createSubField(categoryFieldRepository, "Space Exploration", "NASA, SpaceX, and space missions", science);
            createSubField(categoryFieldRepository, "Physics", "Quantum physics, particle physics, and discoveries", science);
            createSubField(categoryFieldRepository, "Biology & Genetics", "DNA research, evolution, and biotechnology", science);
            createSubField(categoryFieldRepository, "Chemistry", "Chemical research and material science", science);
            createSubField(categoryFieldRepository, "Astronomy", "Stars, planets, and astronomical events", science);
            createSubField(categoryFieldRepository, "Archaeology", "Ancient civilizations, fossils, and historical digs", science);
            createSubField(categoryFieldRepository, "Zoology & Animals", "Animal behavior, species discovery, and wildlife", science);
            createSubField(categoryFieldRepository, "Oceanography", "Deep sea research and marine biology", science);

            // Specific sub-fields under Military & Defense (6)
            createSubField(categoryFieldRepository, "Defense Technology", "Weapons systems and military tech", military);
            createSubField(categoryFieldRepository, "Armed Conflicts", "Active military operations and battles", military);
            createSubField(categoryFieldRepository, "Defense Budgets", "Military spending and procurement", military);
            createSubField(categoryFieldRepository, "Peacekeeping Missions", "UN operations and international peacekeeping", military);
            createSubField(categoryFieldRepository, "Military Exercises", "War games, drills, and joint exercises", military);
            createSubField(categoryFieldRepository, "Nuclear & Deterrence", "Nuclear programs, treaties, and non-proliferation", military);

            // Specific sub-fields under Law & Justice (6)
            createSubField(categoryFieldRepository, "Supreme Court & High Courts", "Major court rulings and judicial decisions", law);
            createSubField(categoryFieldRepository, "Criminal Trials", "High-profile criminal cases and verdicts", law);
            createSubField(categoryFieldRepository, "Civil Rights Cases", "Discrimination, privacy, and constitutional cases", law);
            createSubField(categoryFieldRepository, "Corporate Law", "Business regulations, antitrust, and compliance", law);
            createSubField(categoryFieldRepository, "Cyber Law", "Internet regulations, data privacy, and digital crimes", law);
            createSubField(categoryFieldRepository, "International Law", "ICC, war crimes tribunals, and treaties", law);

            // Specific sub-fields under Culture & Society (6)
            createSubField(categoryFieldRepository, "Social Movements", "Protests, activism, and grassroots movements", culture);
            createSubField(categoryFieldRepository, "Gender & Equality", "Women's rights, LGBTQ+, and inclusivity", culture);
            createSubField(categoryFieldRepository, "Demographics", "Population trends, aging, and migration", culture);
            createSubField(categoryFieldRepository, "Indigenous Cultures", "Native rights, traditions, and heritage", culture);
            createSubField(categoryFieldRepository, "Poverty & Inequality", "Economic disparity and social welfare", culture);
            createSubField(categoryFieldRepository, "Urban Development", "City planning, infrastructure, and housing", culture);

            // Specific sub-fields under Travel & Tourism (5)
            createSubField(categoryFieldRepository, "Travel Destinations", "Tourist attractions and hidden gems", travel);
            createSubField(categoryFieldRepository, "Aviation & Airlines", "Flight news, airports, and airline industry", travel);
            createSubField(categoryFieldRepository, "Hospitality & Hotels", "Hotel openings, reviews, and hospitality trends", travel);
            createSubField(categoryFieldRepository, "Adventure Travel", "Extreme sports, trekking, and outdoor expeditions", travel);
            createSubField(categoryFieldRepository, "Visa & Travel Regulations", "Entry requirements, passports, and border rules", travel);

            // Specific sub-fields under Food & Cuisine (5)
            createSubField(categoryFieldRepository, "Restaurant Reviews", "Dining experiences and chef profiles", food);
            createSubField(categoryFieldRepository, "Recipes & Cooking", "Cooking tips, recipes, and culinary techniques", food);
            createSubField(categoryFieldRepository, "Food Industry", "Food production, supply chains, and recalls", food);
            createSubField(categoryFieldRepository, "Wine & Beverages", "Wine, craft beer, spirits, and beverage trends", food);
            createSubField(categoryFieldRepository, "Street Food", "Local food markets and street food culture", food);

            // Specific sub-fields under Religion & Spirituality (4)
            createSubField(categoryFieldRepository, "Major Faiths", "Islam, Christianity, Judaism, Hinduism, Buddhism news", religion);
            createSubField(categoryFieldRepository, "Interfaith Dialogue", "Religious cooperation and interfaith events", religion);
            createSubField(categoryFieldRepository, "Pilgrimages & Festivals", "Religious travel, Hajj, and holy festivals", religion);
            createSubField(categoryFieldRepository, "Religious Freedom", "Persecution, tolerance, and religious rights", religion);

            // Specific sub-fields under Automotive (5)
            createSubField(categoryFieldRepository, "Electric Vehicles", "EV releases, charging infrastructure, and battery tech", automotive);
            createSubField(categoryFieldRepository, "Auto Industry News", "Manufacturers, layoffs, and production", automotive);
            createSubField(categoryFieldRepository, "Car Reviews", "New model reviews and test drives", automotive);
            createSubField(categoryFieldRepository, "Autonomous Driving", "Self-driving tech, regulations, and testing", automotive);
            createSubField(categoryFieldRepository, "Motorcycles", "Motorcycle launches, racing, and gear", automotive);

            logger.info("Seeded hierarchical category fields successfully.");
        };
    }

    private CategoryField createGeneralField(CategoryFieldRepository repo, String name, String description) {
        // Check if field with this name already exists (idempotent seed)
        return repo.findAll().stream()
            .filter(f -> f.getName().equals(name))
            .findFirst()
            .orElseGet(() -> {
                CategoryField field = new CategoryField();
                field.setName(name);
                field.setDescription(description);
                return repo.save(field);
            });
    }

    private CategoryField createSubField(CategoryFieldRepository repo, String name, String description, CategoryField parent) {
        // Check if sub-field with this name already exists (idempotent seed)
        java.util.Optional<CategoryField> existing = repo.findAll().stream()
            .filter(f -> f.getName().equals(name))
            .findFirst();
        if (existing.isPresent()) {
            CategoryField field = existing.get();
            // Fix orphaned sub-fields that exist without a parent (from earlier seeds)
            if (field.getParent() == null || !field.getParent().getId().equals(parent.getId())) {
                field.setParent(parent);
                field.setDescription(description);
                return repo.save(field);
            }
            return field;
        }
        CategoryField field = new CategoryField();
        field.setName(name);
        field.setDescription(description);
        field.setParent(parent);
        return repo.save(field);
    }

    private void ensureAllowedRole(AllowedRoleRepository repository, UserType userType, UserRole role) {
        if (!repository.existsByUserTypeAndRole(userType, role)) {
            repository.save(new AllowedRole(userType, role));
        }
    }
}