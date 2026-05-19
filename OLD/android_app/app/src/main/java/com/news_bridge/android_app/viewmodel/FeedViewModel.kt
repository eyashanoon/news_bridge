package com.news_bridge.android_app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.news_bridge.android_app.model.FeedPost
import com.news_bridge.android_app.repository.FeedRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class FeedState {
    object Loading : FeedState()
    data class Success(val posts: List<FeedPost>) : FeedState()
    data class Error(val message: String) : FeedState()
}

class FeedViewModel : ViewModel() {

    private val repo = FeedRepository()

    private val _feedState = MutableStateFlow<FeedState>(FeedState.Loading)
    val feedState: StateFlow<FeedState> = _feedState

    fun loadFeed() {
        _feedState.value = FeedState.Loading

        viewModelScope.launch {
            try {
                val posts = repo.getFeed(limit = 15)
                _feedState.value = FeedState.Success(posts)
            } catch (e: Exception) {
                _feedState.value = FeedState.Error(e.message ?: "Unknown error")
            }
        }
    }

    init {
        loadFeed()
    }
}