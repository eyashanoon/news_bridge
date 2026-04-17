package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PostTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostTagRepository extends JpaRepository<PostTag, Long> {

    List<PostTag> findByPostId(Long postId);

    // NEW: bulk fetch
    List<PostTag> findByPostIdIn(List<Long> postIds);
}





