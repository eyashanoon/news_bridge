package com.example.news_bridge_android_app.data.repository

import com.example.news_bridge_android_app.data.local.TokenManager
import com.example.news_bridge_android_app.data.model.*
import com.example.news_bridge_android_app.data.remote.ApiService
import com.example.news_bridge_android_app.data.remote.RetrofitClient
import android.util.Base64
import org.json.JSONObject

class NewsRepository(private val tokenManager: TokenManager) {

    private val api: ApiService get() = RetrofitClient.getApiService()

    // ---------- Auth ----------
    suspend fun ensureUserInitialized(): Pair<String, String> {
        val existingToken = tokenManager.getToken()
        val existingUserId = tokenManager.getUserId()

        if (existingToken != null && existingUserId != null) {
            return Pair(existingToken, existingUserId)
        }

        val response = api.createPrimitiveUser()
        if (!response.isSuccessful) {
            throw Exception("Failed to create primitive user: ${response.code()}")
        }

        val authResponse = response.body() ?: throw Exception("Empty auth response")
        val token = authResponse.token

        // Decode JWT to get user ID (sub claim)
        val userId = decodeJwtSub(token) ?: throw Exception("Token missing sub claim")

        tokenManager.saveAuth(token, userId)
        return Pair(token, userId)
    }

    private fun decodeJwtSub(token: String): String? {
        return try {
            val parts = token.split(".")
            if (parts.size < 2) return null
            val payload = String(Base64.decode(parts[1], Base64.URL_SAFE))
            val json = JSONObject(payload)
            json.optString("sub")
        } catch (e: Exception) {
            null
        }
    }

    // ---------- Feed ----------
    suspend fun getFeed(
        category: String = "General",
        page: Int = 0,
        limit: Int = 10,
        lat: Double? = null,
        lon: Double? = null
    ): List<Post> {
        val (_, userId) = ensureUserInitialized()
        val response = api.getFeed(
            userId = userId,
            category = category,
            page = page,
            limit = limit,
            lat = lat,
            lon = lon
        )
        if (!response.isSuccessful) throw Exception("Feed fetch failed: ${response.code()}")
        return response.body() ?: emptyList()
    }

    // ---------- Reactions ----------
    suspend fun reactToPost(postId: Long, type: String): ReactionResponse {
        val userId = tokenManager.getUserId() ?: throw Exception("User not initialized")
        val response = api.reactToPost(postId, userId, type)
        if (!response.isSuccessful) throw Exception("Reaction failed: ${response.code()}")
        return response.body() ?: ReactionResponse()
    }

    // ---------- View tracking ----------
    suspend fun recordView(postId: Long) {
        try {
            val userId = tokenManager.getUserId() ?: return
            api.recordView(postId, userId)
        } catch (_: Exception) {}
    }

    suspend fun recordTimeSpent(postId: Long, seconds: Double) {
        try {
            val userId = tokenManager.getUserId() ?: return
            api.recordTimeSpent(postId, userId, seconds)
        } catch (_: Exception) {}
    }

    suspend fun recordClick(postId: Long) {
        try {
            val userId = tokenManager.getUserId() ?: return
            api.recordClick(postId, userId)
        } catch (_: Exception) {}
    }

    // ---------- Post content ----------
    suspend fun getPostContent(postId: Long): PostContent {
        val response = api.getPostContent(postId)
        if (!response.isSuccessful) throw Exception("Content fetch failed: ${response.code()}")
        return response.body() ?: PostContent()
    }

    suspend fun getPostMedia(postId: Long): List<MediaItem> {
        val response = api.getPostMedia(postId)
        if (!response.isSuccessful) return emptyList()
        return response.body() ?: emptyList()
    }

    // ---------- Comments ----------
    suspend fun getComments(postId: Long, sortBy: String = "recency"): CommentsResponse {
        val userId = tokenManager.getUserId() ?: throw Exception("User not initialized")
        val response = api.getComments(
            postId = postId,
            sortBy = sortBy,
            userId = userId
        )
        if (!response.isSuccessful) throw Exception("Comments fetch failed: ${response.code()}")
        return response.body() ?: CommentsResponse()
    }

    suspend fun getCommentReplies(commentId: Long): List<Comment> {
        val userId = tokenManager.getUserId() ?: throw Exception("User not initialized")
        val response = api.getCommentReplies(commentId, userId)
        if (!response.isSuccessful) return emptyList()
        return response.body() ?: emptyList()
    }

    suspend fun createComment(postId: Long, content: String, parentCommentId: Long? = null): Comment {
        val userId = tokenManager.getUserId() ?: throw Exception("User not initialized")
        val request = CommentCreateRequest(
            postId = postId,
            content = content,
            parentCommentId = parentCommentId
        )
        val response = api.createComment(userId, request)
        if (!response.isSuccessful) throw Exception("Comment creation failed: ${response.code()}")
        return response.body() ?: throw Exception("Empty comment response")
    }

    suspend fun voteComment(commentId: Long, voteType: Int) {
        val userId = tokenManager.getUserId() ?: throw Exception("User not initialized")
        val response = api.voteComment(commentId, userId, VoteRequest(voteType))
        if (!response.isSuccessful) throw Exception("Vote failed: ${response.code()}")
    }

    // ---------- Location ----------
    suspend fun saveUserLocation(location: LocationData) {
        try {
            val userId = tokenManager.getUserId() ?: return
            api.saveUserLocation(userId, location)
        } catch (_: Exception) {}
    }

    // ---------- AI Ingestion ----------
    suspend fun ingestPostToAI(postId: Long) {
        try {
            api.ingestPostToAI(postId)
        } catch (_: Exception) {}
    }
}