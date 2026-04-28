package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PostTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostTagRepository extends JpaRepository<PostTag, Long> {

    List<PostTag> findByPostId(Long postId);

    // NEW: bulk fetch
    List<PostTag> findByPostIdIn(List<Long> postIds);

    // Find all PostTags where the tag is in the provided list
    List<PostTag> findByTagIn(List<String> tags);
}





