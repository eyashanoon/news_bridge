package com.example.newscrawler.service;

import com.example.newscrawler.entity.AdminActivityAction;
import org.springframework.http.HttpMethod;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Defines which authenticated admin requests count as data-changing activity
 * (create, update, delete, approve, suspend, etc.) — not reads or telemetry.
 */
public final class AdminActivityAuditPolicy {

    private record Rule(Pattern pattern, String method, AdminActivityAction action, String summaryTemplate) {
        boolean matches(String verb, String path) {
            return method.equalsIgnoreCase(verb) && pattern.matcher(path).matches();
        }

        String summarize(String path) {
            if (summaryTemplate == null) {
                return null;
            }
            Matcher matcher = pattern.matcher(path);
            if (!matcher.matches()) {
                return summaryTemplate;
            }
            String out = summaryTemplate;
            for (int i = 1; i <= matcher.groupCount(); i++) {
                String group = matcher.group(i);
                out = out.replace("{" + i + "}", group != null ? group : "");
            }
            return out;
        }
    }

    private static final List<Rule> RULES = List.of(
            // ── Articles ────────────────────────────────────────────────────
            rule("DELETE", "^/articles/(\\d+)$", AdminActivityAction.CONTENT_MODERATION, "Deleted article #{1}"),
            rule("DELETE", "^/articles/(\\d+)/blocks/(\\d+)$", AdminActivityAction.CONTENT_MODERATION, "Deleted block #{2} from article #{1}"),
            rule("PUT", "^/articles/(\\d+)$", AdminActivityAction.CONTENT_MODERATION, "Updated article #{1}"),
            rule("POST", "^/articles$", AdminActivityAction.CONTENT_MODERATION, "Created article"),

            // ── Category fields ─────────────────────────────────────────────
            rule("POST", "^/api/fields$", AdminActivityAction.TOPIC_MANAGEMENT, "Created category field"),
            rule("PUT", "^/api/fields/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Updated category field #{1}"),
            rule("DELETE", "^/api/fields/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Deleted category field #{1}"),

            // ── Events ──────────────────────────────────────────────────────
            rule("POST", "^/api/events$", AdminActivityAction.TOPIC_MANAGEMENT, "Created event"),
            rule("PUT", "^/api/events/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Updated event #{1}"),
            rule("PATCH", "^/api/events/(\\d+)/status$", AdminActivityAction.TOPIC_MANAGEMENT, "Changed event #{1} status"),
            rule("DELETE", "^/api/events/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Deleted event #{1}"),
            rule("PUT", "^/api/events/publish-requests/(\\d+)/approve$", AdminActivityAction.USER_MANAGEMENT, "Approved publish request #{1}"),
            rule("PUT", "^/api/events/publish-requests/(\\d+)/reject$", AdminActivityAction.USER_MANAGEMENT, "Rejected publish request #{1}"),

            // ── Topics ──────────────────────────────────────────────────────
            rule("POST", "^/api/topics$", AdminActivityAction.TOPIC_MANAGEMENT, "Created topic"),
            rule("PUT", "^/api/topics/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Updated topic #{1}"),
            rule("PATCH", "^/api/topics/(\\d+)/status$", AdminActivityAction.TOPIC_MANAGEMENT, "Changed topic #{1} status"),
            rule("DELETE", "^/api/topics/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Deleted topic #{1}"),
            rule("DELETE", "^/api/topics/all$", AdminActivityAction.TOPIC_MANAGEMENT, "Deleted all topics"),
            rule("DELETE", "^/api/topics/(\\d+)/posts/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Deleted topic post #{2} from topic #{1}"),
            rule("POST", "^/api/topics/(\\d+)/approve/(\\d+)$", AdminActivityAction.USER_MANAGEMENT, "Approved editor #{2} for topic #{1}"),
            rule("POST", "^/api/topics/(\\d+)/reject/(\\d+)$", AdminActivityAction.USER_MANAGEMENT, "Rejected editor #{2} for topic #{1}"),
            rule("POST", "^/api/topics/(\\d+)/assign/(\\d+)$", AdminActivityAction.USER_MANAGEMENT, "Assigned editor #{2} to topic #{1}"),

            // ── Live news (admin moderation) ────────────────────────────────
            rule("POST", "^/api/live-news$", AdminActivityAction.TOPIC_MANAGEMENT, "Published live news post"),
            rule("PUT", "^/api/live-news/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Updated live news post #{1}"),
            rule("DELETE", "^/api/live-news/(\\d+)$", AdminActivityAction.TOPIC_MANAGEMENT, "Deleted live news post #{1}"),

            // ── Editor requests ─────────────────────────────────────────────
            rule("POST", "^/api/editor-requests/(\\d+)/approve$", AdminActivityAction.USER_MANAGEMENT, "Approved editor request #{1}"),
            rule("POST", "^/api/editor-requests/(\\d+)/reject$", AdminActivityAction.USER_MANAGEMENT, "Rejected editor request #{1}"),

            // ── Users & editors ─────────────────────────────────────────────
            rule("PUT", "^/api/admin/manage/registered-users/(\\d+)/roles$", AdminActivityAction.USER_MANAGEMENT, "Updated registered user #{1} roles"),
            rule("PUT", "^/api/admin/manage/registered-users/(\\d+)/status$", AdminActivityAction.USER_MANAGEMENT, "Changed registered user #{1} status"),
            rule("DELETE", "^/api/admin/manage/registered-users/(\\d+)$", AdminActivityAction.USER_MANAGEMENT, "Deleted registered user #{1}"),
            rule("PUT", "^/api/admin/manage/editor-users/(\\d+)/roles$", AdminActivityAction.USER_MANAGEMENT, "Updated editor #{1} roles"),
            rule("PUT", "^/api/admin/manage/editor-users/(\\d+)/status$", AdminActivityAction.USER_MANAGEMENT, "Changed editor #{1} status"),
            rule("DELETE", "^/api/admin/manage/editor-users/(\\d+)$", AdminActivityAction.USER_MANAGEMENT, "Deleted editor #{1}"),
            rule("POST", "^/api/users/editor/(\\d+)/suspend$", AdminActivityAction.USER_MANAGEMENT, "Suspended editor #{1}"),

            // ── Sources / crawler ───────────────────────────────────────────
            rule("POST", "^/roots$", AdminActivityAction.CRAWLER_MANAGEMENT, "Created source root"),
            rule("PUT", "^/roots/(\\d+)$", AdminActivityAction.CRAWLER_MANAGEMENT, "Updated source root #{1}"),
            rule("PUT", "^/roots/(\\d+)/status$", AdminActivityAction.CRAWLER_MANAGEMENT, "Changed source root #{1} status"),
            rule("DELETE", "^/roots/(\\d+)$", AdminActivityAction.CRAWLER_MANAGEMENT, "Deleted source root #{1}"),
            rule("POST", "^/roots/(\\d+)/verify$", AdminActivityAction.CRAWLER_MANAGEMENT, "Verified source root #{1}"),
            rule("POST", "^/roots/(\\d+)/discover$", AdminActivityAction.CRAWLER_MANAGEMENT, "Started discovery for root #{1}"),
            rule("POST", "^/roots/(\\d+)/discover/assess$", AdminActivityAction.CRAWLER_MANAGEMENT, "Assessed discovery for root #{1}"),
            rule("POST", "^/roots/(\\d+)/endpoints/bulk$", AdminActivityAction.CRAWLER_MANAGEMENT, "Bulk saved endpoints for root #{1}"),
            rule("POST", "^/endpoints$", AdminActivityAction.CRAWLER_MANAGEMENT, "Created endpoint"),
            rule("POST", "^/endpoints/bulk$", AdminActivityAction.CRAWLER_MANAGEMENT, "Bulk created endpoints"),
            rule("PUT", "^/endpoints/(\\d+)$", AdminActivityAction.CRAWLER_MANAGEMENT, "Updated endpoint #{1}"),
            rule("PUT", "^/endpoints/(\\d+)/status$", AdminActivityAction.CRAWLER_MANAGEMENT, "Changed endpoint #{1} status"),
            rule("PATCH", "^/endpoints/(\\d+)/crawl-stats$", AdminActivityAction.CRAWLER_MANAGEMENT, "Updated crawl stats for endpoint #{1}"),
            rule("DELETE", "^/endpoints/(\\d+)$", AdminActivityAction.CRAWLER_MANAGEMENT, "Deleted endpoint #{1}"),
            rule("POST", "^/cache-endpoints$", AdminActivityAction.CRAWLER_MANAGEMENT, "Created cache endpoint"),
            rule("PUT", "^/cache-endpoints/(\\d+)$", AdminActivityAction.CRAWLER_MANAGEMENT, "Updated cache endpoint #{1}"),
            rule("DELETE", "^/cache-endpoints/(\\d+)$", AdminActivityAction.CRAWLER_MANAGEMENT, "Deleted cache endpoint #{1}"),
            rule("POST", "^/api/admin/crawler/.*", AdminActivityAction.CRAWLER_MANAGEMENT, "Article crawler control action"),
            rule("DELETE", "^/api/admin/crawler/.*", AdminActivityAction.CRAWLER_MANAGEMENT, "Article crawler log action"),
            rule("POST", "^/api/admin/telegram-crawler/.*", AdminActivityAction.CRAWLER_MANAGEMENT, "Telegram crawler control action"),
            rule("DELETE", "^/api/admin/telegram-crawler/.*", AdminActivityAction.CRAWLER_MANAGEMENT, "Telegram crawler log action"),

            // ── Telegram channels & posts ───────────────────────────────────
            rule("POST", "^/api/admin/telegram/channels/(\\d+)/refresh-profile$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Refreshed Telegram channel #{1} profile"),
            rule("POST", "^/api/admin/telegram/posts/(\\d+)/retag$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Re-tagged Telegram post #{1}"),
            rule("POST", "^/api/telegram/channels$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Added Telegram channel"),
            rule("PUT", "^/api/telegram/channels/(\\d+)$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Updated Telegram channel #{1}"),
            rule("PATCH", "^/api/telegram/channels/(\\d+)/status$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Changed Telegram channel #{1} status"),
            rule("DELETE", "^/api/telegram/channels/(\\d+)$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Removed Telegram channel #{1}"),
            rule("PUT", "^/api/telegram/posts/(\\d+)/content$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Updated Telegram post #{1}"),
            rule("DELETE", "^/api/telegram/posts/(\\d+)$", AdminActivityAction.TELEGRAM_MANAGEMENT, "Deleted Telegram post #{1}"),
            rule("POST", "^/api/telegram/onboarding/.*", AdminActivityAction.TELEGRAM_MANAGEMENT, "Telegram channel onboarding step"),

            // ── Admin self profile (email change) ───────────────────────────
            rule("PUT", "^/api/admin/me$", AdminActivityAction.ADMIN_UPDATED, "Updated own admin profile")
    );

    private AdminActivityAuditPolicy() {}

    private static Rule rule(String method, String regex, AdminActivityAction action, String summary) {
        return new Rule(Pattern.compile(regex), method, action, summary);
    }

    /**
     * Normalizes servlet path (no query string) for matching.
     */
    public static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        int query = path.indexOf('?');
        return query >= 0 ? path.substring(0, query) : path;
    }

    public static boolean isAuditable(String method, String path) {
        if (method == null || !isMutating(method)) {
            return false;
        }
        String normalized = normalizePath(path).toLowerCase(Locale.ROOT);
        return RULES.stream().anyMatch(r -> r.matches(method, normalized));
    }

    public static Optional<AdminActivityAction> resolve(String method, String path) {
        String normalized = normalizePath(path).toLowerCase(Locale.ROOT);
        return RULES.stream()
                .filter(r -> r.matches(method, normalized))
                .map(Rule::action)
                .findFirst();
    }

    public static String summarize(String method, String path, int status, Exception ex) {
        String normalized = normalizePath(path).toLowerCase(Locale.ROOT);
        String label = RULES.stream()
                .filter(r -> r.matches(method, normalized))
                .map(r -> r.summarize(normalized))
                .findFirst()
                .orElse(method.toUpperCase(Locale.ROOT) + " " + normalized);

        String outcome = status < 400 && ex == null ? "Completed" : "Failed";
        StringBuilder sb = new StringBuilder(outcome).append(": ").append(label);
        if (status >= 400 || ex != null) {
            sb.append(" (HTTP ").append(status).append(')');
            if (ex != null && ex.getMessage() != null && !ex.getMessage().isBlank()) {
                sb.append(" — ").append(ex.getMessage());
            }
        }
        return sb.toString();
    }

    private static boolean isMutating(String method) {
        String verb = method.toUpperCase(Locale.ROOT);
        return HttpMethod.POST.matches(verb)
                || HttpMethod.PUT.matches(verb)
                || HttpMethod.PATCH.matches(verb)
                || HttpMethod.DELETE.matches(verb);
    }
}
