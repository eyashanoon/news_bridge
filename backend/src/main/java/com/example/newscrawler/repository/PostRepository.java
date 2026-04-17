package com.example.newscrawler.repository;

import com.example.newscrawler.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    // FEED PAGINATED
    Page<Post> findByTagsExtractedTrue(Pageable pageable);
    Page<Post> findByLabelIgnoreCaseAndTagsExtractedTrue(String label, Pageable pageable);

    // FEED UNSEEN
    Page<Post> findByTagsExtractedTrueAndIdNotIn(List<Long> excludedIds, Pageable pageable);
    Page<Post> findByLabelIgnoreCaseAndTagsExtractedTrueAndIdNotIn(String label, List<Long> excludedIds, Pageable pageable);

    // RANDOM POST
    List<Post> findByTagsExtractedTrue();
    List<Post> findByLabelIgnoreCaseAndTagsExtractedTrue(String label);

    // Find posts by article id
    List<Post> findByArticle_Id(Long articleId);
}





