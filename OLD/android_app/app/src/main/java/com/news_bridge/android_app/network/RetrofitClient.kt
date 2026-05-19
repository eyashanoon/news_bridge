package com.news_bridge.android_app.network

import com.news_bridge.android_app.config.AppConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {

    private var authToken: String? = null

    fun setToken(token: String) {
        authToken = token
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
                .header("User-Agent", "NewsBridgeAndroid/1.0")
                .header("Accept", "application/json")
            
            authToken?.let {
                requestBuilder.header("Authorization", "Bearer $it")
            }
            
            chain.proceed(requestBuilder.build())
        }
        .build()

    private val retrofitSpring = Retrofit.Builder()
        .baseUrl(AppConfig.SPRING_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val feedApi: FeedApi = retrofitSpring.create(FeedApi::class.java)
    val authApi: AuthApi = retrofitSpring.create(AuthApi::class.java)
}
