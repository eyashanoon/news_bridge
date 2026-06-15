package com.example.newscrawler.service;

import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class PostReactionService {

    private final PostReactionRepository reactionRepository;
    private final PostTagRepository postTagRepository;
    private final UserPreferenceRepository preferenceRepository;
    private final PostVisibilityService postVisibilityService;

    public PostReactionService(PostReactionRepository reactionRepository,
                               PostTagRepository postTagRepository,
                               UserPreferenceRepository preferenceRepository,
                               PostVisibilityService postVisibilityService) {
        this.reactionRepository = reactionRepository;
        this.postTagRepository = postTagRepository;
        this.preferenceRepository = preferenceRepository;
        this.postVisibilityService = postVisibilityService;
    }

    private void updateUserPreference(AppUser AppUser, String tag, double delta) {
        UserPreference pref = preferenceRepository.findByAppUserIdAndTag(AppUser.getId(), tag)
                .orElse(new UserPreference(AppUser, tag, 0));

        pref.setWeight(pref.getWeight() + delta);
        preferenceRepository.save(pref);
    }

    @Transactional
    public String react(AppUser AppUser, Long postId, ReactionType type) {
        Post post = postVisibilityService.requireVisiblePost(postId);

        double delta = (type == ReactionType.LIKE) ? 3.0 : -3.5;

        return reactionRepository.findByAppUserIdAndPostId(AppUser.getId(), postId)
                .map(existing -> {
                    if (existing.getReactionType() == type) {
                        // remove reaction
                        reactionRepository.delete(existing);

                        // reverse effect slightly
                        updateUserPreference(AppUser, post.getLabel(), -delta * 0.7);

                        List<PostTag> tags = postTagRepository.findByPostId(postId);
                        for (PostTag t : tags) {
                            updateUserPreference(AppUser, t.getTag(), -delta * 0.9);
                        }

                        return "REMOVED";
                    } else {
                        // switch reaction
                        existing.setReactionType(type);
                        reactionRepository.save(existing);

                        updateUserPreference(AppUser, post.getLabel(), delta);

                        List<PostTag> tags = postTagRepository.findByPostId(postId);
                        for (PostTag t : tags) {
                            updateUserPreference(AppUser, t.getTag(), delta * 1.2);
                        }

                        return "UPDATED";
                    }
                })
                .orElseGet(() -> {
                    reactionRepository.save(new PostReaction(AppUser, post, type));

                    updateUserPreference(AppUser, post.getLabel(), delta);

                    List<PostTag> tags = postTagRepository.findByPostId(postId);
                    for (PostTag t : tags) {
                        updateUserPreference(AppUser, t.getTag(), delta * 1.2);
                    }

                    return "ADDED";
                });
    }

    public long getLikesCount(Long postId) {
        return reactionRepository.countByPostIdAndReactionType(postId, ReactionType.LIKE);
    }

    public long getDislikesCount(Long postId) {
        return reactionRepository.countByPostIdAndReactionType(postId, ReactionType.DISLIKE);
    }

    public Optional<ReactionType> getUserReaction(Long appUserId, Long postId) {
        return reactionRepository.findByAppUserIdAndPostId(appUserId, postId)
                .map(PostReaction::getReactionType);
    }
}





