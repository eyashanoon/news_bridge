package com.example.newscrawler.repository;

import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.TelegramChannel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TelegramChannelRepository extends JpaRepository<TelegramChannel, Long> {
    Optional<TelegramChannel> findByChannelUsername(String channelUsername);
    List<TelegramChannel> findByStatus(RecordStatus status);
    boolean existsByChannelUsername(String channelUsername);
}
