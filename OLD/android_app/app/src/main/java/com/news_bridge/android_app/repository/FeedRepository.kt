package com.news_bridge.android_app.repository

import android.util.Base64
import com.news_bridge.android_app.model.FeedPost
import com.news_bridge.android_app.network.RetrofitClient
import org.json.JSONObject

class FeedRepository {

    private var currentUserId: String = "1"

    private suspend fun ensureAuthenticated() {
        try {
            val response = RetrofitClient.authApi.loginLimited()
            val token = response.token
            RetrofitClient.setToken(token)
            
            // Extract userId from JWT payload 'sub' field
            val parts = token.split(".")
            if (parts.size == 3) {
                val payload = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP))
                val json = JSONObject(payload)
                currentUserId = json.optString("sub", "1")
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun getFeed(limit: Int): List<FeedPost> {
        ensureAuthenticated()
        return RetrofitClient.feedApi.getFeed(
            userId = currentUserId,
            category = "general",
            limit = limit
        )
    }
}
