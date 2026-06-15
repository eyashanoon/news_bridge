package com.example.newscrawler.dto;

import java.util.List;
import java.util.Map;

public record NewsGuardVerifyResponse(
        boolean found,
        Integer domainAgeYears,
        Integer trustScore,
        Integer reliabilityScore,
        String biasLabel,
        String trustLabel,
        String description,
        String factualReporting,
        String agendaBias,
        String organizationName,
        String siteDescription,
        Integer biasPosition,
        String trustSource,
        String biasSource,
        String infoSource,
        List<VerificationSourceDto> sources,
        Map<String, Object> metadata
) {}
