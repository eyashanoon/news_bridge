package com.example.newscrawler.service;

import java.net.URI;
import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.example.newscrawler.dto.NewsGuardVerifyResponse;
import com.example.newscrawler.dto.VerificationSourceDto;
import com.example.newscrawler.entity.Root;
import com.example.newscrawler.service.verification.MbfcRatingsCache;
import com.example.newscrawler.service.verification.MbfcRatingsCache.MbfcDataset;
import com.example.newscrawler.service.verification.MbfcRatingsCache.MbfcEntry;
import com.example.newscrawler.service.verification.OpenSourcesRegistry;
import com.example.newscrawler.service.verification.OpenSourcesRegistry.OpenSourcesEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class RootVerificationService {

    private static final Logger log = LoggerFactory.getLogger(RootVerificationService.class);

    private final MbfcRatingsCache mbfcRatingsCache;
    private final OpenSourcesRegistry openSourcesRegistry;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String waybackCdxUrl;
    private final String trancoApiUrl;

    public RootVerificationService(
            MbfcRatingsCache mbfcRatingsCache,
            OpenSourcesRegistry openSourcesRegistry,
            ObjectMapper objectMapper,
            @Value("${wayback.api.cdx-url:https://web.archive.org/cdx/search/cdx}")
            String waybackCdxUrl,
            @Value("${verification.tranco-api-url:https://tranco-list.eu/api/ranks/domain}")
            String trancoApiUrl
    ) {
        this.mbfcRatingsCache = mbfcRatingsCache;
        this.openSourcesRegistry = openSourcesRegistry;
        this.objectMapper = objectMapper;
        this.waybackCdxUrl = waybackCdxUrl;
        this.trancoApiUrl = trancoApiUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(12_000);
        this.restTemplate = new RestTemplate(factory);
    }

    public NewsGuardVerifyResponse verify(Root root) {
        String siteUrl = root.getBaseUrl();
        String domain = extractDomain(siteUrl);
        final String safeDomain = sanitizeDomain(domain);

        List<VerificationSourceDto> sources = new ArrayList<>();
        Map<String, Object> metadata = new LinkedHashMap<>();

        CompletableFuture<WaybackSignal> waybackFuture =
                CompletableFuture.supplyAsync(() -> fetchWayback(safeDomain));
        CompletableFuture<WikidataSignal> wikidataFuture =
                CompletableFuture.supplyAsync(() -> fetchWikidata(safeDomain));
        CompletableFuture<RdapSignal> rdapFuture =
                CompletableFuture.supplyAsync(() -> fetchRdap(safeDomain));
        CompletableFuture<TrancoSignal> trancoFuture =
                CompletableFuture.supplyAsync(() -> fetchTranco(safeDomain));
        CompletableFuture<WikipediaSignal> wikipediaFuture =
                CompletableFuture.supplyAsync(() -> fetchWikipedia(safeDomain, root.getName()));

        Optional<MbfcEntry> mbfc = mbfcRatingsCache.lookup(safeDomain);
        Optional<OpenSourcesEntry> openSources = openSourcesRegistry.lookup(safeDomain);

        WaybackSignal wayback = await(waybackFuture, new WaybackSignal(false, 0, 0));
        WikidataSignal wikidata = await(wikidataFuture, new WikidataSignal(false, "Unknown", null, null, null));
        RdapSignal rdap = await(rdapFuture, new RdapSignal(false, 0, null));
        TrancoSignal tranco = await(trancoFuture, new TrancoSignal(false, 0));
        WikipediaSignal wikipedia = await(wikipediaFuture, new WikipediaSignal(false, null, null, null));

        if (mbfc.isPresent()) {
            MbfcEntry entry = mbfc.get();
            sources.add(new VerificationSourceDto(
                    "Media Bias/Fact Check",
                    true,
                    entry.name() + " — " + mapReportingLabel(entry.reportingCode())
                            + " factual reporting, " + mapBiasLabel(entry.biasCode()) + " bias"
            ));
            metadata.put("mbfcReviewUrl", entry.reviewUrl());
            metadata.put("mbfcCredibility", mapCredibilityLabel(entry.credibilityCode()));
        } else {
            sources.add(new VerificationSourceDto("Media Bias/Fact Check", false, "Domain not in MBFC database"));
        }

        if (openSources.isPresent()) {
            OpenSourcesEntry entry = openSources.get();
            String summary = "Flagged as " + joinNonBlank(entry.primaryType(), entry.secondaryType(), entry.tertiaryType());
            sources.add(new VerificationSourceDto("OpenSources.co", true, summary));
            metadata.put("openSourcesCategory", entry.primaryType());
            metadata.put("openSourcesNotes", entry.notes());
        } else {
            sources.add(new VerificationSourceDto("OpenSources.co", false, "Not listed as unreliable"));
        }

        if (wayback.found()) {
            sources.add(new VerificationSourceDto(
                    "Wayback Machine",
                    true,
                    "Archived since " + wayback.captureYear() + " (" + wayback.ageYears() + " years)"
            ));
            metadata.put("waybackFirstCaptureYear", wayback.captureYear());
        } else {
            sources.add(new VerificationSourceDto("Wayback Machine", false, "No archive captures found"));
        }

        if (wikidata.found()) {
            sources.add(new VerificationSourceDto(
                    "Wikidata",
                    true,
                    joinNonBlank(wikidata.organizationName(), wikidata.biasLabel(), wikidata.country())
            ));
            metadata.put("wikidataId", wikidata.itemId());
            metadata.put("wikidataCountry", wikidata.country());
            if (wikidata.inceptionYear() != null) {
                metadata.put("wikidataInceptionYear", wikidata.inceptionYear());
            }
        } else {
            sources.add(new VerificationSourceDto("Wikidata", false, "No matching organization entry"));
        }

        if (rdap.found()) {
            sources.add(new VerificationSourceDto(
                    "RDAP",
                    true,
                    "Registered " + rdap.registrationYear() + " (" + rdap.ageYears() + " years ago)"
            ));
            metadata.put("domainRegistered", rdap.registrationDate());
        } else {
            sources.add(new VerificationSourceDto("RDAP", false, "Registration data unavailable"));
        }

        if (tranco.found()) {
            sources.add(new VerificationSourceDto(
                    "Tranco",
                    true,
                    "Global rank #" + tranco.rank() + " (top 1M sites)"
            ));
            metadata.put("trancoRank", tranco.rank());
        } else {
            sources.add(new VerificationSourceDto("Tranco", false, "Not in Tranco top 1M"));
        }

        if (wikipedia.found()) {
            sources.add(new VerificationSourceDto(
                    "Wikipedia",
                    true,
                    wikipedia.title()
            ));
            metadata.put("wikipediaUrl", wikipedia.url());
            if (wikipedia.description() != null && !wikipedia.description().isBlank()) {
                metadata.put("wikipediaExtract", wikipedia.description());
            }
        } else {
            sources.add(new VerificationSourceDto("Wikipedia", false, "No matching article"));
        }

        int domainAgeYears = Math.max(wayback.ageYears(), rdap.ageYears());
        if (domainAgeYears > 0) {
            metadata.put("domainAgeYears", domainAgeYears);
        }

        String organizationName = firstNonBlank(
                mbfc.map(MbfcEntry::name).orElse(null),
                wikidata.organizationName(),
                wikipedia.title(),
                root.getName()
        );

        String biasLabel;
        String agendaBias;
        String factualReporting;
        int reliabilityScore;
        int trustScore;
        String trustSource;
        String biasSource;
        String infoSource;

        if (mbfc.isPresent()) {
            MbfcEntry entry = mbfc.get();
            biasLabel = resolveBiasLabel(entry.biasCode(), wikidata.biasLabel());
            factualReporting = mapReportingLabel(entry.reportingCode());
            reliabilityScore = reportingToReliability(entry.reportingCode(), entry.credibilityCode());
            trustScore = reliabilityScore;
            trustSource = "Media Bias/Fact Check";
            biasSource = "Media Bias/Fact Check";

            MbfcDataset dataset = mbfcRatingsCache.loadDataset();
            String mbfcBiasNote = mbfcRatingsCache.biasDescription(entry.biasCode(), dataset).orElse(null);
            if (mbfcBiasNote != null && !"FN".equals(entry.biasCode())) {
                agendaBias = mbfcBiasNote;
            } else if (!"Unknown".equals(biasLabel)) {
                agendaBias = "Editorial stance rated as " + biasLabel + " by Media Bias/Fact Check.";
            } else {
                agendaBias = "Factual reporting: " + factualReporting + " (Media Bias/Fact Check).";
            }
        } else {
            biasLabel = wikidata.biasLabel();
            factualReporting = inferFactualReporting(openSources, wayback, wikidata, tranco, wikipedia);
            reliabilityScore = inferReliabilityScore(openSources, wayback, rdap, wikidata, tranco, wikipedia, domainAgeYears);
            trustScore = reliabilityScore;
            trustSource = wikidata.found() ? "Wikidata + domain signals" : "Domain reputation signals";
            biasSource = wikidata.found() ? "Wikidata" : "Unknown";
            agendaBias = buildAgendaNotes(biasLabel, openSources);
        }

        if (openSources.isPresent()) {
            reliabilityScore = Math.min(reliabilityScore, 25);
            trustScore = Math.min(trustScore, 25);
            factualReporting = "Very Low";
            biasLabel = agendaFromOpenSources(openSources.get());
            agendaBias = "Listed on OpenSources.co as unreliable (" + joinNonBlank(
                    openSources.get().primaryType(),
                    openSources.get().secondaryType(),
                    openSources.get().tertiaryType()
            ) + ").";
            trustSource = "OpenSources.co";
            biasSource = "OpenSources.co";
        }

        if (wikipedia.found()) {
            infoSource = "Wikipedia";
        } else if (wikidata.found()) {
            infoSource = "Wikidata";
        } else {
            infoSource = "Limited";
        }

        String siteDescription = buildSiteDescription(wikipedia, wikidata, metadata);
        int biasPosition = biasToPosition(biasLabel);

        boolean hasTrust = mbfc.isPresent() || openSources.isPresent() || trustScore > 0;
        boolean hasBias = biasLabel != null && !"Unknown".equals(biasLabel);
        boolean hasInfo = (siteDescription != null && !siteDescription.isBlank()) || wikidata.found();
        boolean found = hasTrust || hasBias || hasInfo;

        if (!found) {
            return new NewsGuardVerifyResponse(
                    false, 0, 0, 0,
                    "Unknown", "NOT FOUND",
                    "No credibility data found from open evaluation sources",
                    null, null, organizationName,
                    null, 0, null, null, null,
                    sources, metadata
            );
        }

        String trustLabel = toTrustLabel(trustScore, mbfc.isPresent(), wikidata.found(), domainAgeYears);
        String description = buildDescription(organizationName, factualReporting, biasLabel, domainAgeYears, sources);

        return new NewsGuardVerifyResponse(
                true,
                domainAgeYears > 0 ? domainAgeYears : null,
                trustScore,
                reliabilityScore,
                biasLabel,
                trustLabel,
                description,
                factualReporting,
                agendaBias,
                organizationName,
                siteDescription,
                biasPosition,
                trustSource,
                biasSource,
                infoSource,
                sources,
                metadata
        );
    }

    private WaybackSignal fetchWayback(String domain) {
        try {
            String cdxUri = UriComponentsBuilder
                    .fromHttpUrl(waybackCdxUrl)
                    .queryParam("url", domain)
                    .queryParam("output", "json")
                    .queryParam("limit", "1")
                    .queryParam("fl", "timestamp")
                    .queryParam("filter", "statuscode:200")
                    .queryParam("from", "19900101")
                    .build()
                    .toUriString();

            ResponseEntity<List> cdxResp = restTemplate.getForEntity(cdxUri, List.class);
            List<?> cdxBody = cdxResp.getBody();
            if (cdxBody != null && cdxBody.size() >= 2) {
                List<?> row = (List<?>) cdxBody.get(1);
                String ts = row.get(0).toString();
                int captureYear = Integer.parseInt(ts.substring(0, 4));
                int ageYears = Math.max(0, Year.now().getValue() - captureYear);
                return new WaybackSignal(true, captureYear, ageYears);
            }
        } catch (Exception ex) {
            log.warn("Wayback CDX call failed for {}: {}", domain, ex.getMessage());
        }
        return new WaybackSignal(false, 0, 0);
    }

    private WikidataSignal fetchWikidata(String domain) {
        try {
            String sparql =
                    "SELECT ?item ?itemLabel ?stanceLabel ?countryLabel ?inception WHERE { " +
                    "?item wdt:P856 ?url. " +
                    "FILTER(CONTAINS(LCASE(STR(?url)), \"" + domain + "\")) " +
                    "OPTIONAL { ?item wdt:P1142 ?stance. } " +
                    "OPTIONAL { ?item wdt:P17 ?country. } " +
                    "OPTIONAL { ?item wdt:P571 ?inception. } " +
                    "SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". } " +
                    "} LIMIT 3";

            String sparqlUri = UriComponentsBuilder
                    .fromHttpUrl("https://query.wikidata.org/sparql")
                    .queryParam("query", sparql)
                    .queryParam("format", "json")
                    .build()
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/sparql-results+json");
            headers.set("User-Agent", "NewsBridgeTrustBot/1.0 (root-verification)");

            ResponseEntity<Map> wdResp = restTemplate.exchange(
                    sparqlUri, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Map<?, ?> wdBody = wdResp.getBody();
            if (wdBody == null) {
                return new WikidataSignal(false, "Unknown", null, null, null);
            }

            Map<?, ?> results = (Map<?, ?>) wdBody.get("results");
            if (results == null) {
                return new WikidataSignal(false, "Unknown", null, null, null);
            }

            List<?> bindings = (List<?>) results.get("bindings");
            if (bindings == null || bindings.isEmpty()) {
                return new WikidataSignal(false, "Unknown", null, null, null);
            }

            Map<?, ?> binding = (Map<?, ?>) bindings.get(0);
            String orgName = labelValue(binding, "itemLabel");
            String bias = "Unknown";
            Map<?, ?> stanceMap = (Map<?, ?>) binding.get("stanceLabel");
            if (stanceMap != null) {
                bias = mapStanceToLabel(stanceMap.get("value").toString());
            } else if (orgName != null) {
                bias = "Center";
            }

            String itemId = null;
            Map<?, ?> itemMap = (Map<?, ?>) binding.get("item");
            if (itemMap != null && itemMap.get("value") != null) {
                String itemUri = itemMap.get("value").toString();
                int slash = itemUri.lastIndexOf('/');
                if (slash >= 0) {
                    itemId = itemUri.substring(slash + 1);
                }
            }

            Integer inceptionYear = null;
            Map<?, ?> inceptionMap = (Map<?, ?>) binding.get("inception");
            if (inceptionMap != null && inceptionMap.get("value") != null) {
                inceptionYear = parseYear(inceptionMap.get("value").toString());
            }

            return new WikidataSignal(true, bias, orgName, labelValue(binding, "countryLabel"), itemId, inceptionYear);
        } catch (Exception ex) {
            log.warn("Wikidata SPARQL call failed for {}: {}", domain, ex.getMessage());
            return new WikidataSignal(false, "Unknown", null, null, null);
        }
    }

    private RdapSignal fetchRdap(String domain) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/rdap+json");
            ResponseEntity<String> response = restTemplate.exchange(
                    "https://rdap.org/domain/" + domain,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );
            if (response.getBody() == null || response.getBody().isBlank()) {
                return new RdapSignal(false, 0, null);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode events = root.get("events");
            if (events == null || !events.isArray()) {
                return new RdapSignal(false, 0, null);
            }

            for (JsonNode event : events) {
                String action = event.path("eventAction").asText("");
                if (!action.contains("registration")) {
                    continue;
                }
                String date = event.path("eventDate").asText(null);
                if (date == null || date.isBlank()) {
                    continue;
                }
                int year = parseYear(date);
                if (year <= 0) {
                    continue;
                }
                int ageYears = Math.max(0, Year.now().getValue() - year);
                return new RdapSignal(true, ageYears, date);
            }
        } catch (Exception ex) {
            log.warn("RDAP lookup failed for {}: {}", domain, ex.getMessage());
        }
        return new RdapSignal(false, 0, null);
    }

    private TrancoSignal fetchTranco(String domain) {
        try {
            String url = trancoApiUrl.endsWith("/")
                    ? trancoApiUrl + domain
                    : trancoApiUrl + "/" + domain;
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (response.getBody() == null || response.getBody().isBlank()) {
                return new TrancoSignal(false, 0);
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode ranks = root.get("ranks");
            if (ranks == null || !ranks.isArray() || ranks.isEmpty()) {
                return new TrancoSignal(false, 0);
            }
            int rank = ranks.get(0).path("rank").asInt(0);
            if (rank > 0) {
                return new TrancoSignal(true, rank);
            }
        } catch (Exception ex) {
            log.warn("Tranco lookup failed for {}: {}", domain, ex.getMessage());
        }
        return new TrancoSignal(false, 0);
    }

    private WikipediaSignal fetchWikipedia(String domain, String rootName) {
        for (String query : List.of(rootName, domain)) {
            if (query == null || query.isBlank()) {
                continue;
            }
            WikipediaSignal result = searchWikipedia(query);
            if (result.found()) {
                return result;
            }
        }
        return new WikipediaSignal(false, null, null, null);
    }

    private WikipediaSignal searchWikipedia(String query) {
        try {
            String uri = UriComponentsBuilder
                    .fromHttpUrl("https://en.wikipedia.org/w/api.php")
                    .queryParam("action", "opensearch")
                    .queryParam("search", query)
                    .queryParam("limit", "1")
                    .queryParam("namespace", "0")
                    .queryParam("format", "json")
                    .build()
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "NewsBridgeTrustBot/1.0 (root-verification)");
            ResponseEntity<String> response = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (response.getBody() == null) {
                return new WikipediaSignal(false, null, null, null);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            if (!root.isArray() || root.size() < 4) {
                return new WikipediaSignal(false, null, null, null);
            }
            JsonNode titles = root.get(1);
            JsonNode urls = root.get(3);
            if (titles == null || !titles.isArray() || titles.isEmpty()) {
                return new WikipediaSignal(false, null, null, null);
            }
            String title = titles.get(0).asText();
            String url = urls != null && urls.isArray() && !urls.isEmpty()
                    ? urls.get(0).asText()
                    : "https://en.wikipedia.org/wiki/" + title.replace(' ', '_');
            String description = fetchWikipediaSummary(title);
            return new WikipediaSignal(true, title, url, description);
        } catch (Exception ex) {
            log.warn("Wikipedia search failed for {}: {}", query, ex.getMessage());
            return new WikipediaSignal(false, null, null, null);
        }
    }

    private String fetchWikipediaSummary(String title) {
        try {
            String slug = title.trim().replace(' ', '_');
            String encoded = java.net.URLEncoder.encode(slug, java.nio.charset.StandardCharsets.UTF_8)
                    .replace("+", "%20");
            String uri = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encoded;
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "NewsBridgeTrustBot/1.0 (root-verification)");
            ResponseEntity<String> response = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (response.getBody() == null || response.getBody().isBlank()) {
                return null;
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            String extract = root.path("extract").asText(null);
            if (extract != null && extract.length() > 600) {
                return extract.substring(0, 597) + "...";
            }
            return extract;
        } catch (Exception ex) {
            log.warn("Wikipedia summary failed for {}: {}", title, ex.getMessage());
            return null;
        }
    }

    private static String buildSiteDescription(
            WikipediaSignal wikipedia,
            WikidataSignal wikidata,
            Map<String, Object> metadata
    ) {
        if (wikipedia.found() && wikipedia.description() != null && !wikipedia.description().isBlank()) {
            return wikipedia.description();
        }
        StringBuilder sb = new StringBuilder();
        if (wikidata.organizationName() != null) {
            sb.append(wikidata.organizationName());
        }
        if (wikidata.country() != null) {
            if (sb.length() > 0) sb.append(" — ");
            sb.append("Based in ").append(wikidata.country());
        }
        if (wikidata.inceptionYear() != null) {
            if (sb.length() > 0) sb.append(". ");
            sb.append("Founded ").append(wikidata.inceptionYear()).append(".");
        }
        Object notes = metadata.get("openSourcesNotes");
        if (sb.length() == 0 && notes != null) {
            sb.append(notes.toString());
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static int biasToPosition(String biasLabel) {
        if (biasLabel == null) return 0;
        return switch (biasLabel) {
            case "Far Left" -> -90;
            case "Left" -> -70;
            case "Center-Left" -> -35;
            case "Center" -> 0;
            case "Center-Right" -> 35;
            case "Right" -> 70;
            case "Far Right" -> 90;
            case "Conspiracy", "Fake News" -> -50;
            case "Satire" -> 0;
            case "Pro-Science" -> -15;
            default -> 0;
        };
    }

    private static int reportingToReliability(String reportingCode, String credibilityCode) {
        int score = switch (reportingCode == null ? "" : reportingCode) {
            case "VH" -> 95;
            case "H" -> 85;
            case "MF" -> 72;
            case "M" -> 50;
            case "L" -> 28;
            case "VL" -> 12;
            default -> 45;
        };
        if ("H".equals(credibilityCode)) {
            score = Math.min(100, score + 5);
        } else if ("L".equals(credibilityCode)) {
            score = Math.max(5, score - 8);
        }
        return score;
    }

    /** MBFC "FN" is an internal bucket code, not political bias — prefer Wikidata stance when available. */
    private static String resolveBiasLabel(String mbfcBiasCode, String wikidataBias) {
        if (mbfcBiasCode == null || "FN".equals(mbfcBiasCode)) {
            if (wikidataBias != null && !"Unknown".equals(wikidataBias)) {
                return wikidataBias;
            }
            if ("FN".equals(mbfcBiasCode)) {
                return "Unrated";
            }
            return mapBiasLabel(mbfcBiasCode);
        }
        return mapBiasLabel(mbfcBiasCode);
    }

    private static String inferFactualReporting(
            Optional<OpenSourcesEntry> openSources,
            WaybackSignal wayback,
            WikidataSignal wikidata,
            TrancoSignal tranco,
            WikipediaSignal wikipedia
    ) {
        if (openSources.isPresent()) {
            return "Very Low";
        }
        int signals = 0;
        if (wayback.found() && wayback.ageYears() >= 10) signals++;
        if (wikidata.found()) signals++;
        if (tranco.found() && tranco.rank() <= 50_000) signals++;
        if (wikipedia.found()) signals++;
        if (signals >= 3) return "High";
        if (signals == 2) return "Mixed";
        if (signals == 1) return "Low";
        return "Unknown";
    }

    private static int inferReliabilityScore(
            Optional<OpenSourcesEntry> openSources,
            WaybackSignal wayback,
            RdapSignal rdap,
            WikidataSignal wikidata,
            TrancoSignal tranco,
            WikipediaSignal wikipedia,
            int domainAgeYears
    ) {
        if (openSources.isPresent()) {
            return 15;
        }

        int score = 20;
        if (domainAgeYears >= 20) score += 25;
        else if (domainAgeYears >= 10) score += 20;
        else if (domainAgeYears >= 5) score += 12;
        else if (domainAgeYears >= 2) score += 6;

        if (wayback.found()) score += 5;
        if (rdap.found()) score += 5;
        if (wikidata.found()) score += 15;
        if (wikipedia.found()) score += 10;

        if (tranco.found()) {
            if (tranco.rank() <= 1_000) score += 20;
            else if (tranco.rank() <= 10_000) score += 15;
            else if (tranco.rank() <= 100_000) score += 10;
            else score += 5;
        }

        return Math.min(100, score);
    }

    private static String buildAgendaNotes(String biasLabel, Optional<OpenSourcesEntry> openSources) {
        if (openSources.isPresent()) {
            return agendaFromOpenSources(openSources.get());
        }
        if (biasLabel == null || "Unknown".equals(biasLabel)) {
            return "No editorial agenda bias identified from open sources.";
        }
        return "Editorial stance appears " + biasLabel + " based on Wikidata organization metadata.";
    }

    private static String agendaFromOpenSources(OpenSourcesEntry entry) {
        return "Agenda flagged: " + joinNonBlank(entry.primaryType(), entry.secondaryType(), entry.tertiaryType());
    }

    private static String buildDescription(
            String organizationName,
            String factualReporting,
            String biasLabel,
            int domainAgeYears,
            List<VerificationSourceDto> sources
    ) {
        long matched = sources.stream().filter(VerificationSourceDto::matched).count();
        String agePart = domainAgeYears > 0
                ? domainAgeYears + "-year web presence"
                : "limited historical data";
        return organizationName + ": " + factualReporting + " factual reporting, "
                + biasLabel + " bias, " + agePart + " (" + matched + " open-source signals matched).";
    }

    private static String toTrustLabel(int trustScore, boolean inMbfc, boolean inWikidata, int domainAgeYears) {
        if (trustScore >= 85) return "MAJOR SOURCE";
        if (trustScore >= 70) return "PROMINENT";
        if (trustScore >= 55) return "ESTABLISHED";
        if (trustScore >= 35) return "EMERGING";
        if (inMbfc || inWikidata || domainAgeYears >= 2) return "CAUTION";
        return "NEW SITE";
    }

    private static String mapBiasLabel(String code) {
        if (code == null) return "Unknown";
        return switch (code) {
            case "L" -> "Left";
            case "LC" -> "Center-Left";
            case "C" -> "Center";
            case "RC" -> "Center-Right";
            case "R" -> "Right";
            case "CP" -> "Conspiracy";
            case "FN" -> "Unrated";
            case "PS" -> "Pro-Science";
            case "S" -> "Satire";
            default -> "Unknown";
        };
    }

    private static String mapReportingLabel(String code) {
        if (code == null) return "Unknown";
        return switch (code) {
            case "VH" -> "Very High";
            case "H" -> "High";
            case "MF" -> "Mostly Factual";
            case "M" -> "Mixed";
            case "L" -> "Low";
            case "VL" -> "Very Low";
            default -> "Unknown";
        };
    }

    private static String mapCredibilityLabel(String code) {
        if (code == null) return "Unknown";
        return switch (code) {
            case "H" -> "High";
            case "M" -> "Medium";
            case "L" -> "Low";
            default -> "Unknown";
        };
    }

    private static String mapStanceToLabel(String raw) {
        if (raw == null) return "Unknown";
        String s = raw.toLowerCase();
        if (s.contains("far-left") || s.contains("far left") || s.contains("extreme left")) return "Far Left";
        if (s.contains("left-wing") || s.contains("leftist") || s.contains("progressive")) return "Left";
        if (s.contains("centre-left") || s.contains("center-left")) return "Center-Left";
        if (s.contains("centrist") || s.contains("centrism") || s.contains("centre") || s.contains("center")) return "Center";
        if (s.contains("centre-right") || s.contains("center-right")) return "Center-Right";
        if (s.contains("right-wing") || s.contains("rightist") || s.contains("conservat")) return "Right";
        if (s.contains("far-right") || s.contains("far right") || s.contains("extreme right")) return "Far Right";
        return "Unknown";
    }

    private static String extractDomain(String siteUrl) {
        try {
            URI parsed = new URI(siteUrl);
            String host = parsed.getHost();
            if (host == null || host.isBlank()) {
                return siteUrl;
            }
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (Exception e) {
            return siteUrl;
        }
    }

    private static String sanitizeDomain(String domain) {
        return domain.replaceAll("[^a-zA-Z0-9.\\-]", "");
    }

    private static String labelValue(Map<?, ?> binding, String key) {
        Map<?, ?> map = (Map<?, ?>) binding.get(key);
        if (map == null || map.get("value") == null) {
            return null;
        }
        return map.get("value").toString();
    }

    private static int parseYear(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        try {
            if (value.length() >= 4 && Character.isDigit(value.charAt(0))) {
                return Integer.parseInt(value.substring(0, 4));
            }
            return LocalDate.parse(value.substring(0, Math.min(10, value.length()))).getYear();
        } catch (DateTimeParseException | NumberFormatException ex) {
            return 0;
        }
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String joinNonBlank(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append(part);
        }
        return sb.toString();
    }

    private <T> T await(CompletableFuture<T> future, T fallback) {
        try {
            return future.get(15, TimeUnit.SECONDS);
        } catch (Exception ex) {
            log.warn("Verification signal timed out: {}", ex.getMessage());
            return fallback;
        }
    }

    private record WaybackSignal(boolean found, int captureYear, int ageYears) {}
    private record WikidataSignal(
            boolean found,
            String biasLabel,
            String organizationName,
            String country,
            String itemId,
            Integer inceptionYear
    ) {
        WikidataSignal(boolean found, String biasLabel, String organizationName, String country, String itemId) {
            this(found, biasLabel, organizationName, country, itemId, null);
        }
    }
    private record RdapSignal(boolean found, int ageYears, String registrationDate) {
        int registrationYear() {
            return ageYears > 0 ? Year.now().getValue() - ageYears : 0;
        }
    }
    private record TrancoSignal(boolean found, int rank) {}
    private record WikipediaSignal(boolean found, String title, String url, String description) {}
}
