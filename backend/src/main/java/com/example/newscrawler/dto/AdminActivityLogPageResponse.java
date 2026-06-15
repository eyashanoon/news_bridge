package com.example.newscrawler.dto;

import java.util.List;

public class AdminActivityLogPageResponse {
    public List<AdminActivityLogResponse> items;
    public int page;
    public int size;
    public long totalElements;
    public int totalPages;
}
