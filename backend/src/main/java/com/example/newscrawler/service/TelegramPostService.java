package com.example.newscrawler.service;

import com.example.newscrawler.dto.CreateTelegramPostRequest;
import com.example.newscrawler.dto.TelegramPostResponse;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.entity.TelegramPost;
import com.example.newscrawler.repository.TelegramChannelRepository;
import com.example.newscrawler.repository.TelegramPostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TelegramPostService {

    @Autowired
    private TelegramPostRepository postRepo;

    @Autowired
    private TelegramChannelRepository channelRepo;

    public Page<TelegramPostResponse> getAll(int page, int size) {
        Page<TelegramPost> p = postRepo.findAllByOrderByMessageDateDesc(
                PageRequest.of(page, size));
        return p.map(this::toResponse);
    }

    public Page<TelegramPostResponse> getByChannel(Long channelId, int page, int size) {
        Page<TelegramPost> p = postRepo.findByChannel_Id(channelId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "messageDate")));
        return p.map(this::toResponse);
    }

    public TelegramPostResponse getById(Long id) {
        TelegramPost post = postRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        return toResponse(post);
    }

    public Map<String, Object> bulkCreate(List<CreateTelegramPostRequest> requests) {
        int created = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        for (CreateTelegramPostRequest req : requests) {
            try {
                if (postRepo.existsByChannel_IdAndTelegramMessageId(req.channelId, req.telegramMessageId)) {
                    skipped++;
                    continue;
                }
                TelegramChannel ch = channelRepo.findById(req.channelId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Channel not found: " + req.channelId));

                TelegramPost post = new TelegramPost();
                post.setChannel(ch);
                post.setTelegramMessageId(req.telegramMessageId);
                post.setContent(req.content);
                post.setMediaUrl(req.mediaUrl);
                post.setMediaType(req.mediaType);
                post.setMessageDate(req.messageDate != null ? req.messageDate : Instant.now());
                post.setViewCount(req.viewCount);
                post.setEdited(req.edited);
                postRepo.save(post);

                ch.setTotalPostsCollected((int) postRepo.countByChannel_Id(ch.getId()));
                ch.setLastCrawledAt(Instant.now());
                channelRepo.save(ch);

                created++;
            } catch (Exception ex) {
                errors.add("msg_id=" + req.telegramMessageId + ": " + ex.getMessage());
            }
        }

        return Map.of(
                "created", created,
                "skipped", skipped,
                "errors", errors
        );
    }

    public void delete(Long id) {
        if (!postRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        postRepo.deleteById(id);
    }

    public TelegramPostResponse updateContent(Long id, String content) {
        TelegramPost post = postRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        post.setContent(content);
        post.setEdited(true);
        return toResponse(postRepo.save(post));
    }

    private TelegramPostResponse toResponse(TelegramPost p) {
        TelegramPostResponse r = new TelegramPostResponse();
        r.id = p.getId();
        r.channelId = p.getChannel().getId();
        r.channelUsername = p.getChannel().getChannelUsername();
        r.channelDisplayName = p.getChannel().getDisplayName();
        r.telegramMessageId = p.getTelegramMessageId();
        r.content = p.getContent();
        r.mediaUrl = p.getMediaUrl();
        r.mediaType = p.getMediaType();
        r.messageDate = p.getMessageDate();
        r.viewCount = p.getViewCount();
        r.edited = p.isEdited();
        r.collectedAt = p.getCollectedAt();
        return r;
    }
}
