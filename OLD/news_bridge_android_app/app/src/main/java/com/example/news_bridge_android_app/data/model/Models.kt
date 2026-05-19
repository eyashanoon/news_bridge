package com.example.news_bridge_android_app.data.model

import com.google.gson.annotations.SerializedName

data class Post(
    val id: Long = 0,
    val title: String? = null,
    val text: String? = null,
    val label: String = "General",
    val lang: String? = null,
    val likes: Int = 0,
    val dislikes: Int = 0,
    val userReaction: String? = null,
    val tags: List<String> = emptyList(),
    val articleUrl: String? = null,
    val articleId: Long? = null,
    val articleCreatedAt: String? = null,
    val numImages: Int = 0
)

data class MediaItem(
    val type: String = "image",
    val url: String = ""
)

data class PostContent(
    val content: List<ContentItem> = emptyList()
)

data class ContentItem(
    val type: String = "",
    val text: String? = null,
    val url: String? = null,
    val mediaType: String? = null,
    val sortOrder: Int = 0
)

data class ReactionResponse(
    val likes: Int = 0,
    val dislikes: Int = 0,
    val status: String? = null
)

data class Comment(
    val id: Long = 0,
    val userId: String? = null,
    val userIdentifier: String? = null,
    val content: String = "",
    val createdAt: String? = null,
    val voteScore: Int = 0,
    val userVote: Int = 0,
    val attachmentUrl: String? = null,
    val attachmentType: String? = null,
    val replies: List<Comment> = emptyList()
)

data class CommentsResponse(
    val content: List<Comment> = emptyList(),
    val totalElements: Int = 0,
    val totalPages: Int = 0,
    val number: Int = 0
)

data class CommentCreateRequest(
    val postId: Long,
    val content: String,
    val parentCommentId: Long? = null,
    val attachmentUrl: String? = null,
    val attachmentType: String? = null
)

data class VoteRequest(
    val voteType: Int
)

data class AuthResponse(
    val token: String = "",
    val roles: List<String> = emptyList()
)

data class LocationData(
    val name: String = "",
    val lat: Double = 0.0,
    val lon: Double = 0.0,
    val auto: Boolean = false
)