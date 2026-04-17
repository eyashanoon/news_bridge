package com.example.newscrawler.service;

import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class InteractionService {

    private final PostRepository postRepository;
    private final PostInteractionRepository interactionRepository;
    private final PostTagRepository postTagRepository;
    private final UserPreferenceRepository preferenceRepository;

    public InteractionService(PostRepository postRepository,
                              PostInteractionRepository interactionRepository,
                              PostTagRepository postTagRepository,
                              UserPreferenceRepository preferenceRepository) {
        this.postRepository = postRepository;
        this.interactionRepository = interactionRepository;
        this.postTagRepository = postTagRepository;
        this.preferenceRepository = preferenceRepository;
    }

    private void updateUserPreference(AppUser AppUser, String tag, double delta) {
        UserPreference pref = preferenceRepository.findByAppUserIdAndTag(AppUser.getId(), tag)
                .orElse(new UserPreference(AppUser, tag, 0));

        pref.setWeight(pref.getWeight() + delta);
        preferenceRepository.save(pref);
    }

    public void recordView(AppUser AppUser, Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        PostInteraction interaction = interactionRepository
                .findByAppUserIdAndPostId(AppUser.getId(), postId)
                .orElse(new PostInteraction(AppUser, post));

        interaction.setViews(interaction.getViews() + 1);
        interaction.setLastViewedAt(LocalDateTime.now());

        interactionRepository.save(interaction);

        // update category preference small boost
        updateUserPreference(AppUser, post.getLabel(), 0.2);

        // update tags preference small boost
        List<PostTag> tags = postTagRepository.findByPostId(postId);
        for (PostTag t : tags) {
            updateUserPreference(AppUser, t.getTag(), 0.15);
        }
    }

    public void recordTimeSpent(AppUser AppUser, Long postId, double seconds) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        PostInteraction interaction = interactionRepository
                .findByAppUserIdAndPostId(AppUser.getId(), postId)
                .orElse(new PostInteraction(AppUser, post));

        interaction.setTotalTimeSpent(interaction.getTotalTimeSpent() + seconds);

        interactionRepository.save(interaction);

        double boost = Math.min(seconds / 30.0, 2.0);

        updateUserPreference(AppUser, post.getLabel(), boost * 0.3);

        List<PostTag> tags = postTagRepository.findByPostId(postId);
        for (PostTag t : tags) {
            updateUserPreference(AppUser, t.getTag(), boost * 0.5);
        }
    }

    public void recordClick(AppUser AppUser, Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        PostInteraction interaction = interactionRepository
                .findByAppUserIdAndPostId(AppUser.getId(), postId)
                .orElse(new PostInteraction(AppUser, post));

        interaction.setClicks(interaction.getClicks() + 1);

        interactionRepository.save(interaction);

        updateUserPreference(AppUser, post.getLabel(), 1.0);

        List<PostTag> tags = postTagRepository.findByPostId(postId);
        for (PostTag t : tags) {
            updateUserPreference(AppUser, t.getTag(), 1.5);
        }
    }
}





