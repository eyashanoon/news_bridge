package com.example.newscrawler.dto;

import java.util.List;

public class TelegramSimilarityGraphDto {
    public List<GraphNodeDto> nodes;
    public List<GraphEdgeDto> edges;

    public static class GraphNodeDto {
        public Long id;
        public String label;
        public String username;
    }

    public static class GraphEdgeDto {
        public Long source;
        public Long target;
        public double similarity;
    }
}
