package com.example.newscrawler.repository;

import com.example.newscrawler.entity.Post;
import com.example.newscrawler.util.PostVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {

    String VISIBLE_TO_USERS = PostVisibility.JPQL_VISIBLE_TO_USERS;

    // FEED PAGINATED (article posts only — telegram lives in Special News)
    @Query("SELECT p FROM Post p WHERE p.tagsExtracted = true AND p.telegramPost IS NULL" + VISIBLE_TO_USERS)
    Page<Post> findByTagsExtractedTrue(Pageable pageable);

    @Query("SELECT p FROM Post p WHERE LOWER(p.label) = LOWER(:label) AND p.tagsExtracted = true AND p.telegramPost IS NULL" + VISIBLE_TO_USERS)
    Page<Post> findByLabelIgnoreCaseAndTagsExtractedTrue(@Param("label") String label, Pageable pageable);

    // FEED UNSEEN
    @Query("SELECT p FROM Post p WHERE p.tagsExtracted = true AND p.telegramPost IS NULL AND p.id NOT IN :excludedIds" + VISIBLE_TO_USERS)
    Page<Post> findByTagsExtractedTrueAndIdNotIn(@Param("excludedIds") List<Long> excludedIds, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE LOWER(p.label) = LOWER(:label) AND p.tagsExtracted = true AND p.telegramPost IS NULL AND p.id NOT IN :excludedIds" + VISIBLE_TO_USERS)
    Page<Post> findByLabelIgnoreCaseAndTagsExtractedTrueAndIdNotIn(@Param("label") String label, @Param("excludedIds") List<Long> excludedIds, Pageable pageable);

    // ALL POSTS (no tagsExtracted filter) — used by news brief (articles only)
    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL" + VISIBLE_TO_USERS + " ORDER BY p.createdAt DESC")
    List<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT p FROM Post p WHERE LOWER(p.label) = LOWER(:label) AND p.telegramPost IS NULL" + VISIBLE_TO_USERS + " ORDER BY p.createdAt DESC")
    List<Post> findByLabelIgnoreCaseOrderByCreatedAtDesc(@Param("label") String label, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND p.lang = :lang" + VISIBLE_TO_USERS + " ORDER BY p.createdAt DESC")
    Page<Post> findByLangOrderByCreatedAtDesc(@Param("lang") String lang, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND LOWER(p.label) = LOWER(:label) AND p.lang = :lang" + VISIBLE_TO_USERS + " ORDER BY p.createdAt DESC")
    Page<Post> findByLabelIgnoreCaseAndLangOrderByCreatedAtDesc(@Param("label") String label, @Param("lang") String lang, Pageable pageable);

    @Query("SELECT COUNT(p) FROM Post p WHERE p.tagsExtracted = true AND p.telegramPost IS NULL" + VISIBLE_TO_USERS)
    long countFeedEligiblePosts();

    @Query("SELECT COUNT(p) FROM Post p WHERE LOWER(p.label) = LOWER(:label) AND p.tagsExtracted = true AND p.telegramPost IS NULL" + VISIBLE_TO_USERS)
    long countFeedEligiblePostsByCategory(@Param("label") String label);

    // RANDOM POST
    @Query("SELECT p FROM Post p WHERE p.tagsExtracted = true" + VISIBLE_TO_USERS)
    List<Post> findByTagsExtractedTrue();

    @Query("SELECT p FROM Post p WHERE LOWER(p.label) = LOWER(:label) AND p.tagsExtracted = true" + VISIBLE_TO_USERS)
    List<Post> findByLabelIgnoreCaseAndTagsExtractedTrue(@Param("label") String label);

    // Find posts by article id
    List<Post> findByArticle_Id(Long articleId);

    // === SEARCH QUERIES ===

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%')))" + VISIBLE_TO_USERS)
    Page<Post> searchByQuery(@Param("query") String query, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%')))" + VISIBLE_TO_USERS)
    List<Post> searchByQueryAll(@Param("query") String query);

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "LOWER(p.label) = LOWER(:category)" + VISIBLE_TO_USERS)
    Page<Post> searchByQueryAndCategory(@Param("query") String query, @Param("category") String category, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "p.lang = :lang" + VISIBLE_TO_USERS)
    Page<Post> searchByQueryAndLang(@Param("query") String query, @Param("lang") String lang, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.telegramPost IS NULL AND (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "LOWER(p.label) = LOWER(:category) AND p.lang = :lang" + VISIBLE_TO_USERS)
    Page<Post> searchByQueryAndCategoryAndLang(@Param("query") String query, @Param("category") String category, @Param("lang") String lang, Pageable pageable);

    @Query("SELECT p FROM Post p LEFT JOIN FETCH p.article a LEFT JOIN FETCH a.endpoint e LEFT JOIN FETCH e.root WHERE p.id = :id")
    Optional<Post> findByIdWithArticle(@Param("id") Long id);

    @Query("SELECT p FROM Post p LEFT JOIN FETCH p.article a LEFT JOIN FETCH a.endpoint e LEFT JOIN FETCH e.root WHERE p.id = :id")
    Optional<Post> findByIdWithArticleAndSource(@Param("id") Long id);
}
