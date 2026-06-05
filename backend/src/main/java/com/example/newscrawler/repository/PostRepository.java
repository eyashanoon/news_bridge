package com.example.newscrawler.repository;

import com.example.newscrawler.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    // FEED PAGINATED
    Page<Post> findByTagsExtractedTrue(Pageable pageable);
    Page<Post> findByLabelIgnoreCaseAndTagsExtractedTrue(String label, Pageable pageable);

    // FEED UNSEEN
    Page<Post> findByTagsExtractedTrueAndIdNotIn(List<Long> excludedIds, Pageable pageable);
    Page<Post> findByLabelIgnoreCaseAndTagsExtractedTrueAndIdNotIn(String label, List<Long> excludedIds, Pageable pageable);

    // ALL POSTS (no tagsExtracted filter) — used by news brief
    List<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<Post> findByLabelIgnoreCaseOrderByCreatedAtDesc(String label, Pageable pageable);

    // Search: language-only filter (paginated)
    @Query("SELECT p FROM Post p WHERE p.lang = :lang ORDER BY p.createdAt DESC")
    Page<Post> findByLangOrderByCreatedAtDesc(@Param("lang") String lang, Pageable pageable);

    // Search: category + language (paginated)
    @Query("SELECT p FROM Post p WHERE LOWER(p.label) = LOWER(:label) AND p.lang = :lang ORDER BY p.createdAt DESC")
    Page<Post> findByLabelIgnoreCaseAndLangOrderByCreatedAtDesc(@Param("label") String label, @Param("lang") String lang, Pageable pageable);

    // RANDOM POST
    List<Post> findByTagsExtractedTrue();
    List<Post> findByLabelIgnoreCaseAndTagsExtractedTrue(String label);

    // Find posts by article id
    List<Post> findByArticle_Id(Long articleId);

    // === SEARCH QUERIES ===

    // Search by keyword across title and text
    @Query("SELECT p FROM Post p WHERE " +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Post> searchByQuery(@Param("query") String query, Pageable pageable);

    // Search by keyword - unlimited results
    @Query("SELECT p FROM Post p WHERE " +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Post> searchByQueryAll(@Param("query") String query);

    // Search by keyword with category filter
    @Query("SELECT p FROM Post p WHERE (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "LOWER(p.label) = LOWER(:category)")
    Page<Post> searchByQueryAndCategory(@Param("query") String query, @Param("category") String category, Pageable pageable);

    // Search with language filter
    @Query("SELECT p FROM Post p WHERE (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "p.lang = :lang")
    Page<Post> searchByQueryAndLang(@Param("query") String query, @Param("lang") String lang, Pageable pageable);

    // Search with category and language
    @Query("SELECT p FROM Post p WHERE (" +
           "LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "LOWER(p.label) = LOWER(:category) AND p.lang = :lang")
    Page<Post> searchByQueryAndCategoryAndLang(@Param("query") String query, @Param("category") String category, @Param("lang") String lang, Pageable pageable);

    // Get single post by id with article joined
    @Query("SELECT p FROM Post p LEFT JOIN FETCH p.article WHERE p.id = :id")
    java.util.Optional<Post> findByIdWithArticle(@Param("id") Long id);
}