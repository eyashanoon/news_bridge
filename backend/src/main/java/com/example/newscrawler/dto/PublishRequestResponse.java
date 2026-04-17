package com.example.newscrawler.dto;

import java.time.Instant;

public class PublishRequestResponse {
    public Long id;
    public Long eventId;
    public String eventTitle;
    public Long editorId;
    public String editorEmail;
    public String editorName;
    public String status;
    public Instant requestedAt;
    public Instant reviewedAt;
    public String reviewedByEmail;
}
