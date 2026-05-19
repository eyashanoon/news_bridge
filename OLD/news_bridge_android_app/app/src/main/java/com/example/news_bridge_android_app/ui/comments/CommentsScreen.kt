package com.example.news_bridge_android_app.ui.comments

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.news_bridge_android_app.data.model.Comment
import com.example.news_bridge_android_app.data.model.Post

fun timeAgo(value: String): String {
    return try {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val date = sdf.parse(value) ?: return "just now"
        val diffMs = System.currentTimeMillis() - date.time
        val min = diffMs / 60000
        val hrs = min / 60
        val days = hrs / 24
        when {
            min < 1 -> "just now"
            min < 60 -> "${min}m ago"
            hrs < 24 -> "${hrs}h ago"
            days < 7 -> "${days}d ago"
            else -> java.text.SimpleDateFormat("MMM d", java.util.Locale.US).format(date)
        }
    } catch (_: Exception) { "just now" }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentsScreen(
    viewModel: CommentsViewModel,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val post = uiState.post ?: return

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Comments",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("← Back", color = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1E293B)
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF1F5F9))
        ) {
            // Sort selector
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${uiState.comments.size} Comments",
                    fontWeight = FontWeight.Bold
                )
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton(onClick = { expanded = true }) {
                        Text(
                            when (uiState.sortBy) {
                                "newest" -> "Newest"
                                "oldest" -> "Oldest"
                                "most_popular" -> "Most Popular"
                                else -> "Recency"
                            }
                        )
                    }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        listOf("recency", "newest", "oldest", "most_popular").forEach { sort ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        when (sort) {
                                            "newest" -> "Newest"
                                            "oldest" -> "Oldest"
                                            "most_popular" -> "Most Popular"
                                            else -> "Recency"
                                        }
                                    )
                                },
                                onClick = {
                                    viewModel.setSortBy(sort)
                                    expanded = false
                                }
                            )
                        }
                    }
                }
            }

            // Comments list
            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Post Preview
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = post.title ?: "Untitled",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                                post.text?.let {
                                    Text(
                                        text = it.take(220),
                                        fontSize = 14.sp,
                                        color = Color(0xFF64748B),
                                        maxLines = 2
                                    )
                                }
                            }
                        }
                    }

                    if (uiState.comments.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "No comments yet. Be the first to comment.",
                                    color = Color.Gray
                                )
                            }
                        }
                    }

                    items(uiState.comments, key = { it.id }) { comment ->
                        CommentItemView(
                            comment = comment,
                            onReply = { viewModel.setReplyTo(comment) },
                            onVote = { voteType -> viewModel.voteComment(comment.id, voteType) }
                        )
                    }
                }
            }

            // Reply indicator
            uiState.replyToComment?.let { replyTo ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFFEFF6FF)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Replying to ${replyTo.userIdentifier ?: "User ${replyTo.userId}"}",
                            fontSize = 12.sp,
                            color = Color(0xFF1D4ED8)
                        )
                        TextButton(onClick = { viewModel.setReplyTo(null) }) {
                            Text("Cancel", fontSize = 12.sp)
                        }
                    }
                }
            }

            // Comment input
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shadowElevation = 8.dp,
                color = Color.White
            ) {
                Row(
                    modifier = Modifier.padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = uiState.draft,
                        onValueChange = { viewModel.setDraft(it) },
                        placeholder = { Text(if (uiState.replyToComment != null) "Write a reply..." else "Write a comment...") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        shape = RoundedCornerShape(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { viewModel.submitComment() },
                        enabled = uiState.draft.isNotBlank(),
                        shape = RoundedCornerShape(24.dp)
                    ) {
                        Text(if (uiState.replyToComment != null) "Reply" else "Post")
                    }
                }
            }
        }
    }
}

@Composable
private fun CommentItemView(
    comment: Comment,
    onReply: () -> Unit,
    onVote: (Int) -> Unit,
    depth: Int = 0
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = (depth * 16).dp)
            .background(Color.White)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth()
        ) {
            // Avatar placeholder
            Surface(
                modifier = Modifier.size(36.dp),
                shape = CircleShape,
                color = Color(0xFF1E293B)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        (comment.userIdentifier ?: "U").take(1).uppercase(),
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = comment.userIdentifier ?: "User ${comment.userId}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = timeAgo(comment.createdAt ?: ""),
                        fontSize = 11.sp,
                        color = Color.Gray
                    )
                }
                
                Text(
                    text = comment.content,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp),
                    color = Color(0xFF334155)
                )

                // Actions
                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = { onVote(if (comment.userVote == 1) 0 else 1) },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Text(
                                "▲",
                                color = if (comment.userVote == 1) Color(0xFF10B981) else Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            text = "${comment.voteScore}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 4.dp),
                            color = if (comment.userVote == 1) Color(0xFF10B981) else Color(0xFF64748B)
                        )
                        IconButton(
                            onClick = { onVote(if (comment.userVote == -1) 0 else -1) },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Text(
                                "▼",
                                color = if (comment.userVote == -1) Color(0xFFEF4444) else Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                        }
                    }

                    TextButton(
                        onClick = onReply,
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier.height(24.dp)
                    ) {
                        Text("Reply", fontSize = 12.sp, color = Color(0xFF2563EB))
                    }
                }
            }
        }
        
        HorizontalDivider(thickness = 0.5.dp, color = Color(0xFFE2E8F0))

        // Nested replies
        comment.replies.forEach { reply ->
            CommentItemView(
                comment = reply,
                onReply = onReply,
                onVote = onVote,
                depth = depth + 1
            )
        }
    }
}
