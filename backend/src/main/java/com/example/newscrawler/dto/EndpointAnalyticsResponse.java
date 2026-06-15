package com.example.newscrawler.dto;

import java.util.List;

public record EndpointAnalyticsResponse(
        long totalEndpoints,
        long activeEndpoints,
        long disabledEndpoints,
        List<LabelCountDto> endpointsByDepth,
        List<LabelCountDto> endpointsByRoot,
        List<LabelCountDto> largestPathGroups,
        List<LabelCountDto> mostActivePathGroups,
        List<RootEndpointAnalyticsDto> rootAnalytics
) {
}
