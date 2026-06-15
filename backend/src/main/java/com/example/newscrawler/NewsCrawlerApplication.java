package com.example.newscrawler;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NewsCrawlerApplication {

    public static void main(String[] args) {
        SpringApplication.run(NewsCrawlerApplication.class, args);
    }
}
