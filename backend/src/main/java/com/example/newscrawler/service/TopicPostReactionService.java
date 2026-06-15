package com.example.newscrawler.service;

import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.TopicPostReactionRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Service
public class TopicPostReactionService {

    private final TopicPostReactionRepository reactionRepository;
    private final TopicPostRepository topicPostRepository;

    public TopicPostReactionService(TopicPostReactionRepository reactionRepository,
                                    TopicPostRepository topicPostRepository) {
        this.reactionRepository = reactionRepository;
        this.topicPostRepository = topicPostRepository;
    }

    @Transactional
    public String react(AppUser appUser, Long topicId, Long topicPostId, ReactionType type) {
        TopicPost post = topicPostRepository.findById(topicPostId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic post not found"));

        if (!post.getTopic().getId().equals(topicId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic post not found");
        }

        return reactionRepository.findByAppUserIdAndTopicPostId(appUser.getId(), topicPostId)
                .map(existing -> {
                    if (existing.getReactionType() == type) {
                        adjustCounts(post, type, -1);
                        reactionRepository.delete(existing);
                        return "REMOVED";
                    }

                    adjustCounts(post, existing.getReactionType(), -1);
                    adjustCounts(post, type, 1);
                    existing.setReactionType(type);
                    reactionRepository.save(existing);
                    return "UPDATED";
                })
                .orElseGet(() -> {
                    reactionRepository.save(new TopicPostReaction(appUser, post, type));
                    adjustCounts(post, type, 1);
                    return "ADDED";
                });
    }

    public Optional<ReactionType> getUserReaction(Long appUserId, Long topicPostId) {
        return reactionRepository.findByAppUserIdAndTopicPostId(appUserId, topicPostId)
                .map(TopicPostReaction::getReactionType);
    }

    private void adjustCounts(TopicPost post, ReactionType type, int delta) {
        if (type == ReactionType.LIKE) {
            post.setLikes(Math.max(0, post.getLikes() + delta));
        } else {
            post.setDislikes(Math.max(0, post.getDislikes() + delta));
        }
        topicPostRepository.save(post);
    }
}
