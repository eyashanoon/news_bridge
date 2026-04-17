package com.example.newscrawler.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.AppUserService;

@RestController
@RequestMapping("/users")
public class AppUserController {

    private final AppUserService appUserService;

    public AppUserController(AppUserService appUserService) {
        this.appUserService = appUserService;
    }

    @GetMapping
    public List<AppUser> listAll() {
        return appUserService.findAll();
    }

    @GetMapping("/{id}")
    public AppUser getById(@PathVariable Long id) {
        return appUserService.findById(id).orElse(null);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        appUserService.delete(id);
    }
}
