package com.example.newscrawler.service;

import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class InteractionService {

    private final PostInteractionRepository interactionRepository;
    private final PostTagRepository postTagRepository;
    private final UserPreferenceRepository preferenceRepository;
    private final PostVisibilityService postVisibilityService;

    public InteractionService(PostInteractionRepository interactionRepository,
                              PostTagRepository postTagRepository,
                              UserPreferenceRepository preferenceRepository,
                              PostVisibilityService postVisibilityService) {
        this.interactionRepository = interactionRepository;
        this.postTagRepository = postTagRepository;
        this.preferenceRepository = preferenceRepository;
        this.postVisibilityService = postVisibilityService;
    }

    private void updateUserPreference(AppUser AppUser, String tag, double delta) {
        // Use upsert logic to avoid race conditions on the (user_id, tag) unique constraint.
        // If the preference exists, update it; otherwise insert.
        UserPreference pref = preferenceRepository.findByAppUserIdAndTag(AppUser.getId(), tag)
                .orElse(null);

        if (pref == null) {
            // No existing preference — try to create one atomically.
            // A concurrent request may have inserted it between the check and now,
            // so we handle the duplicate key gracefully.
            try {
                pref = new UserPreference(AppUser, tag, delta);
                preferenceRepository.save(pref);
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // Duplicate key — another request already inserted this preference.
                // Fetch it again and update.
                pref = preferenceRepository.findByAppUserIdAndTag(AppUser.getId(), tag)
                        .orElseThrow(() -> new RuntimeException("Failed to fetch UserPreference after upsert"));
                pref.setWeight(pref.getWeight() + delta);
                preferenceRepository.save(pref);
            }
        } else {
            pref.setWeight(pref.getWeight() + delta);
            preferenceRepository.save(pref);
        }
    }

    public void recordView(AppUser AppUser, Long postId) {
        Post post = postVisibilityService.requireVisiblePost(postId);

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
        Post post = postVisibilityService.requireVisiblePost(postId);

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
        Post post = postVisibilityService.requireVisiblePost(postId);

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





