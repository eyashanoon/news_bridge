package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TelegramPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TelegramPostRepository extends JpaRepository<TelegramPost, Long> {
    List<TelegramPost> findByChannel_IdOrderByMessageDateDesc(Long channelId);
    Page<TelegramPost> findByChannel_Id(Long channelId, Pageable pageable);
    Page<TelegramPost> findAllByOrderByMessageDateDesc(Pageable pageable);
    boolean existsByChannel_IdAndTelegramMessageId(Long channelId, Long telegramMessageId);
    long countByChannel_Id(Long channelId);
}
