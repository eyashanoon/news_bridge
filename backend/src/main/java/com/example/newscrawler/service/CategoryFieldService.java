package com.example.newscrawler.service;

import com.example.newscrawler.dto.CategoryFieldDto;
import com.example.newscrawler.entity.CategoryField;
import com.example.newscrawler.repository.CategoryFieldRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CategoryFieldService {
    @Autowired
    private CategoryFieldRepository fieldRepository;

    public List<CategoryFieldDto> getAllFields() {
        return fieldRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CategoryFieldDto> getAllFieldsHierarchical() {
        // Get all general fields (parent is null) with their children eagerly loaded in one query
        return fieldRepository.findByParentIsNullWithChildren().stream()
            .map(this::mapToDto)
            .collect(Collectors.toList());
    }

    public CategoryFieldDto createField(CategoryFieldDto dto) {
        CategoryField field = new CategoryField();
        field.setName(dto.name);
        field.setDescription(dto.description);
        if (dto.parentId != null) {
            CategoryField parent = fieldRepository.findById(dto.parentId)
                .orElseThrow(() -> new RuntimeException("Parent field not found"));
            field.setParent(parent);
        }
        field = fieldRepository.save(field);
        return mapToDto(field);
    }

    public CategoryFieldDto updateField(Long id, CategoryFieldDto dto) {
        CategoryField field = fieldRepository.findById(id).orElseThrow(() -> new RuntimeException("Field not found"));
        if (dto.name != null) field.setName(dto.name);
        if (dto.description != null) field.setDescription(dto.description);
        if (dto.parentId != null) {
            CategoryField parent = fieldRepository.findById(dto.parentId)
                .orElseThrow(() -> new RuntimeException("Parent field not found"));
            field.setParent(parent);
        } else if (dto.parentId == null && dto.parentId != null) {
            field.setParent(null);
        }
        return mapToDto(fieldRepository.save(field));
    }

    public void deleteField(Long id) {
        fieldRepository.deleteById(id);
    }

    public CategoryFieldDto mapToDto(CategoryField field) {
        if (field == null) return null;
        CategoryFieldDto dto = new CategoryFieldDto();
        dto.id = field.getId();
        dto.name = field.getName();
        dto.description = field.getDescription();
        if (field.getParent() != null) {
            dto.parentId = field.getParent().getId();
        }
        // Always populate children, defaulting to empty list so JSON always includes a "children" array
        if (field.getChildren() != null && !field.getChildren().isEmpty()) {
            dto.children = field.getChildren().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
        } else {
            dto.children = Collections.emptyList();
        }
        return dto;
    }
}