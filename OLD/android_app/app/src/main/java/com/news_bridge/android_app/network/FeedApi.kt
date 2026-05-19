package com.news_bridge.android_app.network

import com.news_bridge.android_app.model.FeedPost
import retrofit2.http.GET
import retrofit2.http.Query

interface FeedApi {

    @GET("/api/feed")
    suspend fun getFeed(
        @Query("userId") userId: String,
        @Query("category") category: String = "general",
        @Query("limit") limit: Int = 10
    ): List<FeedPost>
}
