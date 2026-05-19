package com.news_bridge.android_app.model

data class FeedPost(
    val postId: Long,
    val title: String? = null,
    val text: String? = null,
    val tag: String? = null,
    val timestamp: String? = null,
    val sourceUrl: String? = null,
    val imageUrl: String? = null,
    val videoUrl: String? = null
)

data class LoginResponse(
    val token: String,
    val email: String?,
    val roles: List<String>
)