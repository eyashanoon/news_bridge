package com.example.newscrawler.dto;

import com.example.newscrawler.entity.SavedCollection;

public class SavedCollectionResponse {

    public String id;
    public String name;
    public String icon;
    public long createdAt;
    public int postCount;

    public static SavedCollectionResponse from(SavedCollection collection, int postCount) {
        SavedCollectionResponse response = new SavedCollectionResponse();
        response.id = collection.getExternalId();
        response.name = collection.getName();
        response.icon = collection.getIcon();
        response.createdAt = collection.getCreatedAt();
        response.postCount = postCount;
        return response;
    }
}
