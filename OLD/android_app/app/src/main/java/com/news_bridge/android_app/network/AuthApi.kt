package com.news_bridge.android_app.network

import com.news_bridge.android_app.model.LoginResponse
import retrofit2.http.POST

interface AuthApi {
    @POST("/auth/limited")
    suspend fun loginLimited(): LoginResponse
}
