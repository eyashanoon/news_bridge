package com.example.newscrawler.service;

import com.example.newscrawler.dto.CreateTelegramChannelRequest;
import com.example.newscrawler.dto.TelegramChannelResponse;
import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.repository.TelegramChannelRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class TelegramChannelService {

    @Autowired
    private TelegramChannelRepository channelRepo;

    public List<TelegramChannelResponse> getAll() {
        return channelRepo.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<TelegramChannelResponse> getActive() {
        return channelRepo.findByStatus(RecordStatus.ACTIVE).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public TelegramChannelResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public TelegramChannelResponse create(CreateTelegramChannelRequest req, String adminEmail) {
        String username = normalizeUsername(req.channelUsername);
        if (channelRepo.existsByChannelUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Channel already exists: " + username);
        }
        TelegramChannel ch = new TelegramChannel();
        ch.setChannelUsername(username);
        ch.setDisplayName(req.displayName != null ? req.displayName : username);
        ch.setDescription(req.description);
        ch.setAvatarUrl(req.avatarUrl);
        ch.setAddedByEmail(adminEmail);
        return toResponse(channelRepo.save(ch));
    }

    public TelegramChannelResponse update(Long id, CreateTelegramChannelRequest req) {
        TelegramChannel ch = findOrThrow(id);
        if (req.channelUsername != null) {
            String username = normalizeUsername(req.channelUsername);
            if (!username.equals(ch.getChannelUsername()) && channelRepo.existsByChannelUsername(username)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Channel already exists: " + username);
            }
            ch.setChannelUsername(username);
        }
        if (req.displayName != null) ch.setDisplayName(req.displayName);
        if (req.description != null) ch.setDescription(req.description);
        if (req.avatarUrl != null) ch.setAvatarUrl(req.avatarUrl);
        return toResponse(channelRepo.save(ch));
    }

    public TelegramChannelResponse changeStatus(Long id, String status) {
        TelegramChannel ch = findOrThrow(id);
        ch.setStatus(RecordStatus.valueOf(status));
        return toResponse(channelRepo.save(ch));
    }

    public void delete(Long id) {
        if (!channelRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found");
        }
        channelRepo.deleteById(id);
    }

    private TelegramChannel findOrThrow(Long id) {
        return channelRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
    }

    private String normalizeUsername(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Channel username is required");
        }
        String u = raw.trim();
        if (u.startsWith("@")) u = u.substring(1);
        if (u.startsWith("https://t.me/")) u = u.substring("https://t.me/".length());
        if (u.startsWith("t.me/")) u = u.substring("t.me/".length());
        return u;
    }

    private TelegramChannelResponse toResponse(TelegramChannel ch) {
        TelegramChannelResponse r = new TelegramChannelResponse();
        r.id = ch.getId();
        r.channelUsername = ch.getChannelUsername();
        r.displayName = ch.getDisplayName();
        r.description = ch.getDescription();
        r.avatarUrl = ch.getAvatarUrl();
        r.status = ch.getStatus().name();
        r.totalPostsCollected = ch.getTotalPostsCollected();
        r.lastCrawledAt = ch.getLastCrawledAt();
        r.addedByEmail = ch.getAddedByEmail();
        r.createdAt = ch.getCreatedAt();
        r.updatedAt = ch.getUpdatedAt();
        return r;
    }
}
