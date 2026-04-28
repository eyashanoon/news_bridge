package com.example.newscrawler.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.dto.ArticleBlockResponse;
import com.example.newscrawler.dto.ArticleBlocksResponse;
import com.example.newscrawler.dto.ArticleContentItemResponse;
import com.example.newscrawler.dto.ArticleContentResponse;
import com.example.newscrawler.dto.MediaItemResponse;
import com.example.newscrawler.dto.ArticleListItemResponse;
import com.example.newscrawler.dto.ArticleResponse;
import com.example.newscrawler.dto.CreateArticleBlockRequest;
import com.example.newscrawler.dto.CreateArticleRequest;
import com.example.newscrawler.dto.CreatePostRequest;
import com.example.newscrawler.dto.PagedResponse;
import com.example.newscrawler.entity.Article;
import com.example.newscrawler.entity.ArticleBlock;
import com.example.newscrawler.entity.ArticleAttachmentBlock;
import com.example.newscrawler.entity.ArticleAudioBlock;
import com.example.newscrawler.entity.ArticleImageBlock;
import com.example.newscrawler.entity.ArticleBlockType;
import com.example.newscrawler.entity.ArticleOtherBlock;
import com.example.newscrawler.entity.ArticleTextBlock;
import com.example.newscrawler.entity.ArticleVideoBlock;
import com.example.newscrawler.entity.ArticleTitle;
import com.example.newscrawler.entity.CacheEndpoint;
import com.example.newscrawler.entity.Endpoint;
import com.example.newscrawler.repository.ArticleRepository;
import com.example.newscrawler.repository.ArticleBlockRepository;
import com.example.newscrawler.repository.CacheEndpointRepository;
import com.example.newscrawler.repository.EndpointRepository;
import com.example.newscrawler.service.PostService;

@Service
public class ArticleService {
    private final ArticleRepository articleRepository;
    private final ArticleBlockRepository articleBlockRepository;
    private final EndpointRepository endpointRepository;
    private final CacheEndpointRepository cacheEndpointRepository;
    private final PostService postService;

    public ArticleService(
            ArticleRepository articleRepository,
            ArticleBlockRepository articleBlockRepository,
            EndpointRepository endpointRepository,
            CacheEndpointRepository cacheEndpointRepository,
            PostService postService
    ) {
        this.articleRepository = articleRepository;
        this.articleBlockRepository = articleBlockRepository;
        this.endpointRepository = endpointRepository;
        this.cacheEndpointRepository = cacheEndpointRepository;
        this.postService = postService;
    }

    @Transactional
    public ArticleResponse create(CreateArticleRequest request) {
        if (articleRepository.existsByUrl(request.url())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Article URL already exists");
        }

        Endpoint endpoint = endpointRepository.findById(request.endpointId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Endpoint not found"));

        CacheEndpoint cacheEndpoint = cacheEndpointRepository.findById(request.cacheEndpointId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cache endpoint not found"));

        Article article = new Article();
        article.setUrl(request.url());
        article.setText(resolveArticleText(request));
        article.setEndpoint(endpoint);
        article.setCacheEndpoint(cacheEndpoint);

        ArticleTitle articleTitle = new ArticleTitle();
        articleTitle.setArticle(article);
        articleTitle.setTitleText(request.title());
        article.setArticleTitle(articleTitle);

        List<ArticleBlock> blocks = new ArrayList<>();
        List<CreateArticleBlockRequest> blockRequests = request.blocks() == null ? List.of() : request.blocks();
        for (CreateArticleBlockRequest blockRequest : blockRequests) {
            blocks.add(createBlock(article, blockRequest));
        }
        article.setBlocks(blocks);

        Article saved = articleRepository.save(article);

        // Create a post for this article
        CreatePostRequest postRequest = new CreatePostRequest(
            article.getText(),
            null, // label
            null, // lang
            article.getArticleTitle() != null ? article.getArticleTitle().getTitleText() : null,
            0, // numImages
            article.getId()
        );
        postService.createPost(postRequest);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ArticleResponse> findAll() {
        return articleRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ArticleResponse> findByEndpoint(Long endpointId) {
        if (!endpointRepository.existsById(endpointId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Endpoint not found");
        }

        return articleRepository.findByEndpointId(endpointId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PagedResponse<ArticleListItemResponse> findForAdmin(Long rootId, Long endpointId, String search, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200));
        Specification<Article> spec = Specification.where(null);

        if (rootId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("endpoint").get("root").get("id"), rootId));
        }
        if (endpointId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("endpoint").get("id"), endpointId));
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("url")), like),
                    cb.like(cb.lower(root.get("text")), like),
                    cb.like(cb.lower(root.get("articleTitle").get("titleText")), like)
            ));
        }

        Page<Article> result = articleRepository.findAll(spec, pageable);
        List<ArticleListItemResponse> items = result.getContent().stream().map(this::toListItem).toList();
        return new PagedResponse<>(items, result.getTotalElements(), result.getNumber(), result.getSize(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public ArticleResponse findById(Long id) {
        return toResponse(findArticle(id));
    }

    @Transactional(readOnly = true)
    public List<ArticleBlockResponse> findAllBlocks() {
        return articleRepository.findAll().stream()
                .flatMap(article -> sortedBlockResponses(article).stream())
                .toList();
    }

    @Transactional(readOnly = true)
    public ArticleBlocksResponse findBlocksById(Long id) {
        Article article = findArticle(id);
        String rootName = articleRepository.findRootNameByArticleId(article.getId()).orElse(null);

        return new ArticleBlocksResponse(
                article.getId(),
            article.getUrl(),
            rootName,
                article.getEndpoint().getId(),
                article.getEndpoint().getUrl(),
                article.getArticleTitle() != null ? article.getArticleTitle().getTitleText() : null,
                article.getCreatedAt(),
                sortedBlockResponses(article)
        );
    }

    @Transactional
    public void deleteBlock(Long articleId, Long blockId) {
        Article article = findArticle(articleId);
        ArticleBlock block = articleBlockRepository.findById(blockId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article block not found"));
        if (!block.getArticle().getId().equals(article.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Block does not belong to article");
        }

        article.getBlocks().removeIf(b -> b.getId().equals(blockId));
        articleRepository.save(article);
    }

    @Transactional(readOnly = true)
    public List<Long> findAllIds() {
        return articleRepository.findAllIds();
    }

    @Transactional
    public ArticleResponse update(Long id, CreateArticleRequest request) {
        Article article = findArticle(id);

        if (!article.getUrl().equals(request.url()) && articleRepository.existsByUrlAndIdNot(request.url(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Article URL already exists");
        }

        Endpoint endpoint = endpointRepository.findById(request.endpointId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Endpoint not found"));

        CacheEndpoint cacheEndpoint = cacheEndpointRepository.findById(request.cacheEndpointId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cache endpoint not found"));

        article.setUrl(request.url());
        article.setText(resolveArticleText(request));
        article.setEndpoint(endpoint);
        article.setCacheEndpoint(cacheEndpoint);

        ArticleTitle articleTitle = article.getArticleTitle();
        if (articleTitle == null) {
            articleTitle = new ArticleTitle();
            articleTitle.setArticle(article);
            article.setArticleTitle(articleTitle);
        }
        articleTitle.setTitleText(request.title());

        article.getBlocks().clear();
        List<CreateArticleBlockRequest> blockRequests = request.blocks() == null ? List.of() : request.blocks();
        for (CreateArticleBlockRequest blockRequest : blockRequests) {
            article.getBlocks().add(createBlock(article, blockRequest));
        }

        return toResponse(articleRepository.save(article));
    }

    public void delete(Long id) {
        if (!articleRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found");
        }
        articleRepository.deleteById(id);
    }

    private String resolveArticleText(CreateArticleRequest request) {
        if (request.text() != null && !request.text().isBlank()) {
            return request.text();
        }

        List<CreateArticleBlockRequest> blocks = request.blocks() == null ? List.of() : request.blocks();
        StringBuilder builder = new StringBuilder();
        for (CreateArticleBlockRequest block : blocks) {
            if (block.blockType() == ArticleBlockType.TEXT && block.textContent() != null && !block.textContent().isBlank()) {
                if (builder.length() > 0) {
                    builder.append("\n\n");
                }
                builder.append(block.textContent().trim());
            }
        }
        if (builder.length() > 0) {
            return builder.toString();
        }

        return request.title();
    }

    private Article findArticle(Long id) {
        return articleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found"));
    }

    private ArticleBlock createBlock(Article article, CreateArticleBlockRequest blockRequest) {
        ArticleBlock block = switch (blockRequest.blockType()) {
            case TEXT -> {
                ArticleTextBlock textBlock = new ArticleTextBlock();
                textBlock.setTextContent(blockRequest.textContent());
                yield textBlock;
            }
            case IMAGE -> {
                ArticleImageBlock imageBlock = new ArticleImageBlock();
                imageBlock.setMediaUrl(blockRequest.mediaUrl());
                imageBlock.setAltText(blockRequest.altText());
                yield imageBlock;
            }
            case VIDEO -> {
                ArticleVideoBlock videoBlock = new ArticleVideoBlock();
                videoBlock.setMediaUrl(blockRequest.mediaUrl());
                videoBlock.setAltText(blockRequest.altText());
                yield videoBlock;
            }
            case AUDIO -> {
                ArticleAudioBlock audioBlock = new ArticleAudioBlock();
                audioBlock.setMediaUrl(blockRequest.mediaUrl());
                audioBlock.setAltText(blockRequest.altText());
                yield audioBlock;
            }
            case ATTACHMENT -> {
                ArticleAttachmentBlock attachmentBlock = new ArticleAttachmentBlock();
                attachmentBlock.setMediaUrl(blockRequest.mediaUrl());
                attachmentBlock.setAltText(blockRequest.altText());
                yield attachmentBlock;
            }
            case OTHER -> {
                ArticleOtherBlock otherBlock = new ArticleOtherBlock();
                otherBlock.setMediaUrl(blockRequest.mediaUrl());
                otherBlock.setAltText(blockRequest.altText());
                yield otherBlock;
            }
        };

        block.setArticle(article);
        block.setSortOrder(blockRequest.sortOrder());
        block.setScore(blockRequest.score());
        return block;
    }

    private ArticleResponse toResponse(Article article) {
        List<ArticleBlockResponse> blocks = sortedBlockResponses(article);

        return new ArticleResponse(
                article.getId(),
                article.getUrl(),
                article.getArticleTitle() != null ? article.getArticleTitle().getTitleText() : null,
                article.getText(),
                article.getEndpoint().getId(),
                article.getCacheEndpoint().getId(),
                blocks,
                article.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public java.util.List<MediaItemResponse> findMediaById(Long id) {
        Article article = findArticle(id);
        return article.getBlocks().stream()
            .sorted(Comparator.comparing(ArticleBlock::getSortOrder)
                .thenComparing(block -> block.getId() == null ? Long.MAX_VALUE : block.getId()))
            .filter(b -> b.getBlockType() == ArticleBlockType.IMAGE || b.getBlockType() == ArticleBlockType.VIDEO)
            .map(b -> new MediaItemResponse(
                b.getBlockType() == ArticleBlockType.VIDEO ? "video" : "image",
                b.getMediaUrl(),
                b.getAltText()
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public ArticleContentResponse findContentById(Long id) {
        Article article = findArticle(id);
        List<ArticleContentItemResponse> content = article.getBlocks().stream()
            .sorted(Comparator.comparing(ArticleBlock::getSortOrder)
                .thenComparing(block -> block.getId() == null ? Long.MAX_VALUE : block.getId()))
            .map(this::toContentItem)
            .filter(item -> item != null)
            .toList();
        return new ArticleContentResponse(content);
    }

    private ArticleListItemResponse toListItem(Article article) {
        return new ArticleListItemResponse(
                article.getId(),
                article.getArticleTitle() != null ? article.getArticleTitle().getTitleText() : null,
                article.getUrl(),
                article.getEndpoint().getRoot().getId(),
                article.getEndpoint().getRoot().getName(),
                article.getEndpoint().getId(),
                article.getEndpoint().getUrl(),
                article.getCreatedAt()
        );
    }

            private List<ArticleBlockResponse> sortedBlockResponses(Article article) {
            return article.getBlocks().stream()
                .sorted(Comparator.comparing(ArticleBlock::getSortOrder)
                    .thenComparing(block -> block.getId() == null ? Long.MAX_VALUE : block.getId()))
                .map(this::toBlockResponse)
                .toList();
            }

    private ArticleBlockResponse toBlockResponse(ArticleBlock block) {
        return new ArticleBlockResponse(
                block.getId(),
                block.getSortOrder(),
                block.getBlockType(),
                block.getTextContent(),
                block.getMediaUrl(),
                block.getAltText(),
                block.getScore(),
                block.getCreatedAt()
        );
    }

    private ArticleContentItemResponse toContentItem(ArticleBlock block) {
        if (block.getBlockType() == ArticleBlockType.TEXT) {
            String text = block.getTextContent();
            if (text == null || text.isBlank()) {
                return null;
            }
            return new ArticleContentItemResponse(
                "paragraph",
                text,
                null,
                null,
                block.getSortOrder()
            );
        }

        if (block.getBlockType() == ArticleBlockType.IMAGE || block.getBlockType() == ArticleBlockType.VIDEO) {
            String mediaUrl = block.getMediaUrl();
            if (mediaUrl == null || mediaUrl.isBlank()) {
                return null;
            }
            return new ArticleContentItemResponse(
                "media",
                null,
                mediaUrl,
                block.getBlockType() == ArticleBlockType.VIDEO ? "video" : "image",
                block.getSortOrder()
            );
        }

        return null;
    }
}
