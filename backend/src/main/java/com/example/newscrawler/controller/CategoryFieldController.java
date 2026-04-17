package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CategoryFieldDto;
import com.example.newscrawler.service.CategoryFieldService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/fields")
public class CategoryFieldController {

    @Autowired
    private CategoryFieldService fieldService;

    @GetMapping
    public List<CategoryFieldDto> getAllFields() {
        return fieldService.getAllFields();
    }

    @PostMapping
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS')")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryFieldDto createField(@RequestBody CategoryFieldDto field) {  
        return fieldService.createField(field);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS')")
    public CategoryFieldDto updateField(@PathVariable Long id, @RequestBody CategoryFieldDto field) {  
        return fieldService.updateField(id, field);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteField(@PathVariable Long id) {
        fieldService.deleteField(id);
    }
}
