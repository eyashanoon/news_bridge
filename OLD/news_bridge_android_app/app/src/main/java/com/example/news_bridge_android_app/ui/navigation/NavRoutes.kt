package com.example.news_bridge_android_app.ui.navigation

object NavRoutes {
    const val FEED = "feed"
    const val POST_DETAIL = "post_detail/{postId}"
    const val COMMENTS = "comments/{postId}"
    const val AI_CHAT = "ai_chat/{postId}"

    fun postDetail(postId: Long) = "post_detail/$postId"
    fun comments(postId: Long) = "comments/$postId"
    fun aiChat(postId: Long) = "ai_chat/$postId"
}