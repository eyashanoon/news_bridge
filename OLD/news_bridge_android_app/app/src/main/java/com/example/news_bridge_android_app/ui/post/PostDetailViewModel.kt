package com.example.news_bridge_android_app.ui.post

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.news_bridge_android_app.data.model.*
import com.example.news_bridge_android_app.data.repository.NewsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PostDetailUiState(
    val post: Post? = null,
    val content: PostContent = PostContent(),
    val media: List<MediaItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val likesCount: Int = 0,
    val dislikesCount: Int = 0,
    val userReaction: String? = null
)

class PostDetailViewModel(private val repository: NewsRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(PostDetailUiState())
    val uiState: StateFlow<PostDetailUiState> = _uiState.asStateFlow()

    fun loadPost(post: Post) {
        _uiState.value = PostDetailUiState(
            post = post,
            likesCount = post.likes,
            dislikesCount = post.dislikes,
            userReaction = post.userReaction
        )
        loadContent(post.id)
        loadMedia(post.id)
        recordView(post.id)
    }

    private fun loadContent(postId: Long) {
        viewModelScope.launch {
            try {
                val content = repository.getPostContent(postId)
                _uiState.value = _uiState.value.copy(content = content)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    private fun loadMedia(postId: Long) {
        viewModelScope.launch {
            try {
                val media = repository.getPostMedia(postId)
                _uiState.value = _uiState.value.copy(media = media)
            } catch (_: Exception) {}
        }
    }

    private fun recordView(postId: Long) {
        viewModelScope.launch {
            repository.recordView(postId)
        }
    }

    fun react(type: String) {
        val post = _uiState.value.post ?: return
        viewModelScope.launch {
            try {
                val response = repository.reactToPost(post.id, type)
                _uiState.value = _uiState.value.copy(
                    likesCount = response.likes,
                    dislikesCount = response.dislikes,
                    userReaction = if (response.status == "REMOVED") null else type
                )
            } catch (_: Exception) {}
        }
    }

    fun recordClick() {
        val post = _uiState.value.post ?: return
        viewModelScope.launch {
            repository.recordClick(post.id)
        }
    }
}