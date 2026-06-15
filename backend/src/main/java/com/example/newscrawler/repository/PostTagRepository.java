package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PostTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public interface PostTagRepository extends JpaRepository<PostTag, Long> {

    String VISIBLE_POSTS_JOIN =
            " JOIN posts p ON p.id = pt.post_id"
                    + " LEFT JOIN articles a ON a.id = p.article_id"
                    + " LEFT JOIN endpoints e ON e.id = a.endpoint_id"
                    + " LEFT JOIN roots r ON r.id = e.root_id";

    String VISIBLE_POSTS_FILTER =
            " AND (p.article_id IS NULL OR (e.status = 'ACTIVE' AND r.status = 'ACTIVE'))";

    @Query(value = "SELECT post_id, tag FROM PostTags WHERE post_id = :postId", nativeQuery = true)
    List<Object[]> findTagRowsByPostId(@Param("postId") Long postId);

    @Query(value = "SELECT post_id, tag FROM PostTags WHERE post_id IN (:postIds)", nativeQuery = true)
    List<Object[]> findTagRowsByPostIds(@Param("postIds") Collection<Long> postIds);

    @Query(value = "SELECT pt.post_id, pt.tag FROM PostTags pt WHERE LOWER(pt.tag) IN (:tags)", nativeQuery = true)
    List<Object[]> findTagRowsByTagIn(@Param("tags") List<String> tags);

    @Query(
            value = "SELECT pt.post_id, pt.tag, p.created_at FROM PostTags pt"
                    + VISIBLE_POSTS_JOIN
                    + " WHERE LOWER(pt.tag) IN (:tags)"
                    + VISIBLE_POSTS_FILTER,
            nativeQuery = true)
    List<Object[]> findVisibleTagRowsByTagIn(@Param("tags") List<String> tags);

    default List<PostTag> findByPostId(Long postId) {
        return toPostTags(findTagRowsByPostId(postId));
    }

    default List<PostTag> findByPostIdIn(List<Long> postIds) {
        if (postIds == null || postIds.isEmpty()) {
            return List.of();
        }
        return toPostTags(findTagRowsByPostIds(postIds));
    }

    default Map<Long, List<String>> findTagsByPostIds(Collection<Long> postIds) {
        if (postIds == null || postIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, List<String>> tagsMap = new HashMap<>();
        for (Object[] row : findTagRowsByPostIds(postIds)) {
            Long postId = ((Number) row[0]).longValue();
            String tag = (String) row[1];
            tagsMap.computeIfAbsent(postId, ignored -> new ArrayList<>()).add(tag);
        }
        return tagsMap;
    }

    default List<PostTag> findByTagIn(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }
        return toPostTags(findTagRowsByTagIn(tags));
    }

    default List<PostTag> findVisibleByTagIn(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }
        return toPostTags(findVisibleTagRowsByTagIn(tags));
    }

    private static List<PostTag> toPostTags(List<Object[]> rows) {
        List<PostTag> tags = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            tags.add(new PostTag(null, (String) row[1]));
        }
        return tags;
    }

    @Modifying
    @Query(value = "DELETE FROM PostTags WHERE post_id = :postId", nativeQuery = true)
    void deleteByPostId(@Param("postId") Long postId);
}



