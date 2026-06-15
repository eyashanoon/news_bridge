package com.example.newscrawler.dto;

import java.time.Instant;

public class EditorStatsResponse {
    public long totalEditors;
    public long activeEditors;
    public long pendingEditors;
    public long suspendedEditors;
    public long totalPublishedContent;
    public double averageContentPerEditor;
    public String lastActiveEditorName;
    public String lastActiveEditorEmail;
    public Instant lastActiveEditorAt;
}
