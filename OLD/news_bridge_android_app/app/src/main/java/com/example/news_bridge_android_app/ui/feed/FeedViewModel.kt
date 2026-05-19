package com.example.news_bridge_android_app.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.news_bridge_android_app.data.model.LocationData
import com.example.news_bridge_android_app.data.model.Post
import com.example.news_bridge_android_app.data.repository.NewsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class FeedUiState(
    val posts: List<Post> = emptyList(),
    val currentCategory: String = "General",
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val hasMore: Boolean = true,
    val currentPage: Int = 0,
    val error: String? = null,
    val selectedLocation: LocationData? = null
)

class FeedViewModel(private val repository: NewsRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    private var currentPage = 0
    private var isLoadingMore = false
    private var hasMore = true

    init {
        loadFeed()
    }

    fun selectCategory(category: String) {
        if (_uiState.value.currentCategory == category) return
        _uiState.value = _uiState.value.copy(
            currentCategory = category,
            posts = emptyList(),
            currentPage = 0,
            hasMore = true
        )
        currentPage = 0
        hasMore = true
        loadFeed()
    }

    fun setLocation(location: LocationData?) {
        _uiState.value = _uiState.value.copy(selectedLocation = location)
        // Refresh feed with new location
        _uiState.value = _uiState.value.copy(
            posts = emptyList(),
            currentPage = 0,
            hasMore = true
        )
        currentPage = 0
        hasMore = true
        loadFeed()
    }

    fun loadFeed() {
        if (isLoadingMore || !hasMore) return

        isLoadingMore = true
        _uiState.value = _uiState.value.copy(
            isLoading = _uiState.value.posts.isEmpty(),
            isLoadingMore = _uiState.value.posts.isNotEmpty(),
            error = null
        )

        viewModelScope.launch {
            try {
                val location = _uiState.value.selectedLocation
                val newPosts = repository.getFeed(
                    category = _uiState.value.currentCategory,
                    page = currentPage,
                    limit = 10,
                    lat = location?.lat,
                    lon = location?.lon
                )

                if (newPosts.isEmpty()) {
                    hasMore = false
                } else {
                    val existingIds = _uiState.value.posts.map { it.id }.toSet()
                    val filtered = newPosts.filter { it.id !in existingIds }
                    _uiState.value = _uiState.value.copy(
                        posts = _uiState.value.posts + filtered
                    )
                    currentPage++
                }

                _uiState.value = _uiState.value.copy(
                    hasMore = hasMore,
                    currentPage = currentPage,
                    isLoading = false,
                    isLoadingMore = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoadingMore = false,
                    error = e.message
                )
            } finally {
                isLoadingMore = false
            }
        }
    }

    fun refresh() {
        currentPage = 0
        hasMore = true
        _uiState.value = _uiState.value.copy(
            posts = emptyList(),
            currentPage = 0,
            hasMore = true
        )
        loadFeed()
    }
}