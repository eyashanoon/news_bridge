package com.example.newscrawler.service;

import com.example.newscrawler.dto.CreateLiveNewsPostRequest;
import com.example.newscrawler.dto.LiveNewsPostResponse;
import com.example.newscrawler.dto.UpdateLiveNewsPostRequest;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.LiveNewsPost;
import com.example.newscrawler.entity.NewsEvent;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LiveNewsPostRepository;
import com.example.newscrawler.repository.NewsEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class LiveNewsService {

    @Autowired private LiveNewsPostRepository liveNewsPostRepository;
    @Autowired private NewsEventRepository newsEventRepository;
    @Autowired private EditorUserRepository editorUserRepository;
    @Autowired private NewsEventService newsEventService;

    // ─── Publish a live news post ─────────────────────────────────────────────

    public LiveNewsPostResponse publish(CreateLiveNewsPostRequest req, String editorEmail) {
        if (req.headline == null || req.headline.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Headline is required");
        }
        if (req.content == null || req.content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Content is required");
        }
        NewsEvent event = newsEventRepository.findById(req.eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

        if (!"EDITOR_VISIBLE".equals(event.getStatus()) && !"PUBLIC".equals(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Event is not accepting news posts");
        }

        if (!newsEventService.isEditorApproved(event.getId(), editorEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have publish permission for this event");
        }

        EditorUser author = editorUserRepository.findByEmail(editorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor profile not found"));

        LiveNewsPost post = new LiveNewsPost();
        post.setEvent(event);
        post.setAuthor(author);
        post.setHeadline(req.headline);
        post.setContent(req.content);

        return mapToDto(liveNewsPostRepository.save(post));
    }

    // ─── Get all live news for an event ──────────────────────────────────────

    public List<LiveNewsPostResponse> getByEvent(Long eventId) {
        return liveNewsPostRepository.findByEvent_IdOrderByPublishedAtDesc(eventId)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // ─── Update a post ────────────────────────────────────────────────────────

    public LiveNewsPostResponse update(Long postId, UpdateLiveNewsPostRequest req, String callerEmail, boolean isAdmin) {
        LiveNewsPost post = findPost(postId);
        if (!isAdmin && !post.getAuthor().getEmail().equals(callerEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own posts");
        }
        if (req.headline != null && !req.headline.isBlank()) post.setHeadline(req.headline);
        if (req.content != null && !req.content.isBlank()) post.setContent(req.content);
        return mapToDto(liveNewsPostRepository.save(post));
    }

    // ─── Delete a post ────────────────────────────────────────────────────────

    public void delete(Long postId, String callerEmail, boolean isAdmin) {
        LiveNewsPost post = findPost(postId);
        if (!isAdmin && !post.getAuthor().getEmail().equals(callerEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own posts");
        }
        liveNewsPostRepository.delete(post);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private LiveNewsPost findPost(Long id) {
        return liveNewsPostRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Live news post not found"));
    }

    public LiveNewsPostResponse mapToDto(LiveNewsPost post) {
        LiveNewsPostResponse dto = new LiveNewsPostResponse();
        dto.id = post.getId();
        dto.eventId = post.getEvent().getId();
        dto.eventTitle = post.getEvent().getTitle();
        dto.headline = post.getHeadline();
        dto.content = post.getContent();
        dto.publishedAt = post.getPublishedAt();
        dto.updatedAt = post.getUpdatedAt();
        EditorUser author = post.getAuthor();
        dto.authorId = author.getId();
        dto.authorEmail = author.getEmail();
        dto.authorName = author.getUsername();
        dto.authorAvatar = author.getProfilePicture();
        return dto;
    }
}
