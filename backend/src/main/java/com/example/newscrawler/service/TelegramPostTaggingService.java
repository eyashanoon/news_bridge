package com.example.newscrawler.service;

import com.example.newscrawler.entity.TelegramPost;
import com.example.newscrawler.entity.TelegramPostTag;
import com.example.newscrawler.repository.TelegramPostRepository;
import com.example.newscrawler.repository.TelegramPostTagRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TelegramPostTaggingService {

    private final TelegramPostRepository postRepo;
    private final TelegramPostTagRepository tagRepo;
    private final ChannelTaggingService channelTaggingService;

    public TelegramPostTaggingService(TelegramPostRepository postRepo,
                                      TelegramPostTagRepository tagRepo,
                                      ChannelTaggingService channelTaggingService) {
        this.postRepo = postRepo;
        this.tagRepo = tagRepo;
        this.channelTaggingService = channelTaggingService;
    }

    @Transactional
    public void extractAndSaveTags(TelegramPost post) {
        if (post == null || post.getId() == null) return;

        tagRepo.deleteByTelegramPost_Id(post.getId());

        String text = post.getContent();
        if (text == null || text.isBlank()) {
            post.setTagsExtracted(true);
            postRepo.save(post);
            return;
        }

        Set<String> unique = new LinkedHashSet<>();
        for (String tag : channelTaggingService.extractTagsFromText(text)) {
            if (tag != null && !tag.isBlank()) {
                unique.add(tag.toLowerCase().trim());
            }
        }

        for (String tag : unique) {
            tagRepo.save(new TelegramPostTag(post, tag));
        }

        post.setTagsExtracted(true);
        postRepo.save(post);
    }

    /** Tag posts that were ingested before tagging was enabled. */
    @Transactional
    public int tagUntaggedBatch(int limit) {
        List<TelegramPost> untagged = postRepo.findUntagged(PageRequest.of(0, limit));
        for (TelegramPost post : untagged) {
            extractAndSaveTags(post);
        }
        return untagged.size();
    }
}
