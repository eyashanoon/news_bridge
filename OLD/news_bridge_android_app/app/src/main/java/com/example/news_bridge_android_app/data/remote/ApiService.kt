package com.example.news_bridge_android_app.data.remote

import com.example.news_bridge_android_app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Auth
    @POST("/auth/limited")
    suspend fun createPrimitiveUser(): Response<AuthResponse>

    // Feed
    @GET("/api/feed")
    suspend fun getFeed(
        @Query("userId") userId: String,
        @Query("category") category: String = "General",
        @Query("page") page: Int = 0,
        @Query("limit") limit: Int = 10,
        @Query("lat") lat: Double? = null,
        @Query("lon") lon: Double? = null
    ): Response<List<Post>>

    // Post interactions
    @PUT("/api/posts/{postId}/react")
    suspend fun reactToPost(
        @Path("postId") postId: Long,
        @Query("userId") userId: String,
        @Query("type") type: String
    ): Response<ReactionResponse>

    @POST("/api/posts/{postId}/view")
    suspend fun recordView(
        @Path("postId") postId: Long,
        @Query("userId") userId: String
    ): Response<Unit>

    @POST("/api/posts/{postId}/time")
    suspend fun recordTimeSpent(
        @Path("postId") postId: Long,
        @Query("userId") userId: String,
        @Query("seconds") seconds: Double
    ): Response<Unit>

    @POST("/api/posts/{postId}/click")
    suspend fun recordClick(
        @Path("postId") postId: Long,
        @Query("userId") userId: String
    ): Response<Unit>

    // Post content & media
    @GET("/api/posts/{postId}/content")
    suspend fun getPostContent(
        @Path("postId") postId: Long
    ): Response<PostContent>

    @GET("/api/posts/{postId}/media")
    suspend fun getPostMedia(
        @Path("postId") postId: Long
    ): Response<List<MediaItem>>

    // Comments
    @GET("/api/comments/post/{postId}")
    suspend fun getComments(
        @Path("postId") postId: Long,
        @Query("sortBy") sortBy: String = "recency",
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 50,
        @Query("userId") userId: String
    ): Response<CommentsResponse>

    @GET("/api/comments/{commentId}/replies")
    suspend fun getCommentReplies(
        @Path("commentId") commentId: Long,
        @Query("userId") userId: String
    ): Response<List<Comment>>

    @POST("/api/comments")
    suspend fun createComment(
        @Query("userId") userId: String,
        @Body request: CommentCreateRequest
    ): Response<Comment>

    @POST("/api/comments/{commentId}/vote")
    suspend fun voteComment(
        @Path("commentId") commentId: Long,
        @Query("userId") userId: String,
        @Body request: VoteRequest
    ): Response<Unit>

    // Location
    @POST("/api/user/{userId}/location")
    suspend fun saveUserLocation(
        @Path("userId") userId: String,
        @Body location: LocationData
    ): Response<Unit>

    // AI Assistant ingestion
    @POST("http://10.0.2.2:9000/ingest/post/{postId}")
    suspend fun ingestPostToAI(
        @Path("postId") postId: Long
    ): Response<Unit>
}