package com.example.newscrawler.util;

import com.example.newscrawler.entity.Endpoint;
import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.RecordStatus;

public final class PostVisibility {

    public static final String JPQL_VISIBLE_TO_USERS =
            " AND (p.article IS NULL OR (p.article.endpoint.status = com.example.newscrawler.entity.RecordStatus.ACTIVE"
                    + " AND p.article.endpoint.root.status = com.example.newscrawler.entity.RecordStatus.ACTIVE))";

    private PostVisibility() {
    }

    public static boolean isVisibleToUsers(Post post) {
        if (post == null || post.getArticle() == null) {
            return true;
        }

        Endpoint endpoint = post.getArticle().getEndpoint();
        if (endpoint.getStatus() != RecordStatus.ACTIVE) {
            return false;
        }

        return endpoint.getRoot().getStatus() == RecordStatus.ACTIVE;
    }
}
