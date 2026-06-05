package com.example.newscrawler.dto;

import java.util.List;

public class CategoryFieldDto {
    public Long id;
    public String name;
    public String description;
    public Long parentId;
    public List<CategoryFieldDto> children;
}