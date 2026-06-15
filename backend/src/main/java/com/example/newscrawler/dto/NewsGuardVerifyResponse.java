package com.example.newscrawler.dto;

public record NewsGuardVerifyResponse(
        boolean found,
        Integer domainAgeYears,     // years since oldest Wayback Machine capture
        Integer trustScore,         // 0–100 combined (age + Wikidata presence)
        Integer reliabilityScore,   // 0–100 based on domain age alone
        String  biasLabel,          // "Left" / "Center-Left" / "Center" / "Center-Right" / "Right" / "Unknown"
        String  trustLabel,         // "MAJOR SOURCE" / "PROMINENT" / "ESTABLISHED" / "EMERGING" / "NEW SITE"
        String  description         // human-readable summary
) {}
