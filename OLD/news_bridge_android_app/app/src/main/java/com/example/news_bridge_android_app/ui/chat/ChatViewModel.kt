package com.example.news_bridge_android_app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.news_bridge_android_app.data.model.Post
import com.example.news_bridge_android_app.data.repository.NewsRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ChatMessage(
    val text: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

data class ChatUiState(
    val post: Post? = null,
    val messages: List<ChatMessage> = emptyList(),
    val isTyping: Boolean = false,
    val input: String = ""
)

class ChatViewModel(private val repository: NewsRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    fun loadPost(post: Post) {
        _uiState.value = _uiState.value.copy(
            post = post,
            messages = listOf(
                ChatMessage("Hello! I'm your AI assistant. How can I help you with the article \"${post.title}\"?", false)
            )
        )
        // Trigger ingestion in background
        viewModelScope.launch {
            try {
                repository.ingestPostToAI(post.id)
            } catch (_: Exception) {}
        }
    }

    fun setInput(input: String) {
        _uiState.value = _uiState.value.copy(input = input)
    }

    fun sendMessage() {
        val text = _uiState.value.input.trim()
        if (text.isEmpty()) return

        val userMessage = ChatMessage(text, true)
        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMessage,
            input = "",
            isTyping = true
        )

        viewModelScope.launch {
            // Simulate AI delay
            delay(1500)
            
            val aiResponse = generateMockResponse(text, _uiState.value.post)
            _uiState.value = _uiState.value.copy(
                messages = _uiState.value.messages + ChatMessage(aiResponse, false),
                isTyping = false
            )
        }
    }

    private fun generateMockResponse(query: String, post: Post?): String {
        val q = query.lowercase()
        return when {
            q.contains("summarize") || q.contains("summary") -> {
                "Based on the article, here's a summary: ${post?.text?.take(200) ?: "This article discusses current events in ${post?.label}."}..."
            }
            q.contains("who") -> {
                "The article mentions several key figures, but specifically focuses on the impacts related to ${post?.label}."
            }
            q.contains("why") -> {
                "The reasons discussed in the article include a combination of social factors and recent developments in ${post?.label}."
            }
            else -> "That's an interesting question about \"${post?.title}\". According to my analysis, this falls under ${post?.label} and has received significant engagement from the community."
        }
    }
}
