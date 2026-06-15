package com.example.newscrawler.config;

import com.example.newscrawler.entity.AdminActivityAction;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.service.AdminActivityAuditPolicy;
import com.example.newscrawler.service.AdminActivityLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.lang.NonNull;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Records admin activity only for whitelisted data-changing operations.
 */
@Component
public class AdminActivityAuditInterceptor implements HandlerInterceptor {

    @Autowired
    private AdminActivityLogService activityLogService;

    @Autowired
    private AdminRepository adminRepository;

    @Override
    public void afterCompletion(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull Object handler,
            Exception ex
    ) {
        String method = request.getMethod();
        if (method == null || HttpMethod.OPTIONS.matches(method)) {
            return;
        }

        String path = AdminActivityAuditPolicy.normalizePath(request.getRequestURI());
        if (!AdminActivityAuditPolicy.isAuditable(method, path)) {
            return;
        }

        String email = currentActorEmail();
        if (email == null || !adminRepository.existsByEmail(email)) {
            return;
        }

        AdminActivityAction action = AdminActivityAuditPolicy.resolve(method, path)
                .orElse(AdminActivityAction.SYSTEM_CONFIG);

        String target = method.toUpperCase() + " " + path;
        String result = AdminActivityAuditPolicy.summarize(method, path, response.getStatus(), ex);
        boolean success = response.getStatus() < 400 && ex == null;

        if (success) {
            activityLogService.logSuccess(action, target, result);
        } else {
            activityLogService.logFailure(action, target, result);
        }
    }

    private String currentActorEmail() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                return null;
            }
            String name = auth.getName();
            if (name == null || name.isBlank() || "anonymousUser".equalsIgnoreCase(name)) {
                return null;
            }
            return name;
        } catch (Exception e) {
            return null;
        }
    }
}
