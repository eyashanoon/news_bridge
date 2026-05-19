package com.example.news_bridge_android_app.ui.comments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.news_bridge_android_app.data.model.Comment
import com.example.news_bridge_android_app.data.model.Post
import com.example.news_bridge_android_app.data.repository.NewsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CommentsUiState(
    val post: Post? = null,
    val comments: List<Comment> = emptyList(),
    val isLoading: Boolean = false,
    val sortBy: String = "recency",
    val draft: String = "",
    val replyToComment: Comment? = null,
    val error: String? = null
)

class CommentsViewModel(private val repository: NewsRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(CommentsUiState())
    val uiState: StateFlow<CommentsUiState> = _uiState.asStateFlow()

    fun loadComments(post: Post) {
        _uiState.value = _uiState.value.copy(post = post, isLoading = true)
        fetchComments(post.id)
    }

    private fun fetchComments(postId: Long) {
        viewModelScope.launch {
            try {
                val sort = _uiState.value.sortBy
                val serverSort = if (sort == "most_popular") "popularity" else "recency"
                val response = repository.getComments(postId, serverSort)
                val comments = response.content

                // Fetch replies recursively for each top-level comment
                val threaded = comments.map { comment ->
                    fetchRepliesRecursively(comment)
                }

                val sorted = sortClientSide(threaded)
                _uiState.value = _uiState.value.copy(comments = sorted, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message, isLoading = false)
            }
        }
    }

    private suspend fun fetchRepliesRecursively(comment: Comment): Comment {
        val replies = repository.getCommentReplies(comment.id)
        val hydratedReplies = replies.map { fetchRepliesRecursively(it) }
        return comment.copy(replies = hydratedReplies)
    }

    private fun sortClientSide(items: List<Comment>): List<Comment> {
        val cloned = items.toMutableList()
        return when (_uiState.value.sortBy) {
            "newest", "recency" -> cloned.sortedByDescending { it.createdAt }
            "oldest" -> cloned.sortedBy { it.createdAt }
            "most_popular" -> cloned.sortedByDescending { it.voteScore }
            else -> cloned
        }
    }

    fun setSortBy(sort: String) {
        _uiState.value = _uiState.value.copy(sortBy = sort)
        _uiState.value.post?.let { fetchComments(it.id) }
    }

    fun setDraft(text: String) {
        _uiState.value = _uiState.value.copy(draft = text)
    }

    fun setReplyTo(comment: Comment?) {
        _uiState.value = _uiState.value.copy(replyToComment = comment)
    }

    fun submitComment() {
        val post = _uiState.value.post ?: return
        val draft = _uiState.value.draft.trim()
        if (draft.isEmpty()) return

        val parentId = _uiState.value.replyToComment?.id

        viewModelScope.launch {
            try {
                val created = repository.createComment(post.id, draft, parentId)
                _uiState.value = _uiState.value.copy(
                    draft = "",
                    replyToComment = null
                )
                // Refresh comments
                fetchComments(post.id)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun voteComment(commentId: Long, voteType: Int) {
        viewModelScope.launch {
            try {
                repository.voteComment(commentId, voteType)
                _uiState.value.post?.let { fetchComments(it.id) }
            } catch (_: Exception) {}
        }
    }
}