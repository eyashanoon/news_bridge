package com.example.newscrawler.dto;

import com.example.newscrawler.entity.SavedPost;

import java.util.List;

public class SavedPostResponse {

    public Long id;
    public String text;
    public String label;
    public String lang;
    public String detectedLang;
    public String title;
    public long likes;
    public long dislikes;
    public int numImages;
    public Long articleId;
    public String articleUrl;
    public List<String> tags;
    public List<String> imageUrls;
    public long savedAt;
    public String note;
    public List<String> collections;

    public static SavedPostResponse from(FeedPostDTO dto, SavedPost saved, List<String> collectionIds) {
        SavedPostResponse response = new SavedPostResponse();
        response.id = dto.id;
        response.text = dto.text;
        response.label = dto.label;
        response.lang = dto.lang;
        response.detectedLang = dto.detectedLang;
        response.title = dto.title;
        response.likes = dto.likes;
        response.dislikes = dto.dislikes;
        response.numImages = dto.numImages;
        response.articleId = dto.articleId;
        response.articleUrl = dto.articleUrl;
        response.tags = dto.tags;
        response.imageUrls = dto.imageUrls;
        response.savedAt = saved.getSavedAt();
        response.note = saved.getNote() != null ? saved.getNote() : "";
        response.collections = collectionIds != null ? collectionIds : List.of();
        return response;
    }
}
