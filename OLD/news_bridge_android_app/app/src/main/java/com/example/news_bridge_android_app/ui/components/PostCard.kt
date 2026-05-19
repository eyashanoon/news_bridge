package com.example.news_bridge_android_app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.news_bridge_android_app.data.model.MediaItem
import com.example.news_bridge_android_app.data.model.Post
import com.example.news_bridge_android_app.ui.theme.CategoryColors
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun PostCard(
    post: Post,
    onPostClick: (Post) -> Unit,
    onCommentClick: (Post) -> Unit,
    onVisitClick: (Post) -> Unit,
    onReact: (Post, String) -> Unit,
    onAskAI: (Post) -> Unit = {}
) {
    val colors = CategoryColors.getColors(post.label)
    var likesCount by remember { mutableIntStateOf(post.likes) }
    var dislikesCount by remember { mutableIntStateOf(post.dislikes) }
    var userReaction by remember { mutableStateOf(post.userReaction) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clickable { onPostClick(post) },
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Category and timestamp row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = post.label,
                    color = colors.primary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
                post.articleCreatedAt?.let {
                    Text(
                        text = formatTimeAgo(it),
                        color = Color.Gray,
                        fontSize = 12.sp
                    )
                }
            }

            // Title
            post.title?.let {
                Text(
                    text = it,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            // Text preview
            post.text?.let { text ->
                val maxChars = 220
                val preview = if (text.length > maxChars) text.take(maxChars) + "..." else text
                Text(
                    text = preview,
                    fontSize = 14.sp,
                    color = Color(0xFF374151),
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Tags
            if (post.tags.isNotEmpty()) {
                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    post.tags.take(5).forEach { tag ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFE5E7EB)
                        ) {
                            Text(
                                text = "#$tag",
                                fontSize = 11.sp,
                                color = Color(0xFF374151),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            // Language
            post.lang?.let {
                Text(
                    text = it,
                    fontSize = 11.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            // Action buttons
            Divider(modifier = Modifier.padding(top = 12.dp), color = Color(0xFFE5E7EB))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Like button
                ReactionButton(
                    emoji = "👍",
                    count = likesCount,
                    isActive = userReaction == "LIKE",
                    activeColor = Color(0xFF3B82F6),
                    onClick = {
                        onReact(post, "LIKE")
                        likesCount += if (userReaction == "LIKE") -1 else 1
                        if (userReaction == "DISLIKE") dislikesCount--
                        userReaction = if (userReaction == "LIKE") null else "LIKE"
                    }
                )

                // Dislike button
                ReactionButton(
                    emoji = "👎",
                    count = dislikesCount,
                    isActive = userReaction == "DISLIKE",
                    activeColor = Color(0xFFEF4444),
                    onClick = {
                        onReact(post, "DISLIKE")
                        dislikesCount += if (userReaction == "DISLIKE") -1 else 1
                        if (userReaction == "LIKE") likesCount--
                        userReaction = if (userReaction == "DISLIKE") null else "DISLIKE"
                    }
                )

                // Comment button
                TextButton(
                    onClick = { onCommentClick(post) },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFF6B7280))
                ) {
                    Text("💬 Comment", fontSize = 13.sp)
                }

                // Ask AI button
                TextButton(
                    onClick = { onAskAI(post) },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFF9333EA))
                ) {
                    Text("✨ Ask AI", fontSize = 13.sp)
                }

                // Visit button
                if (post.articleUrl != null) {
                    TextButton(
                        onClick = { onVisitClick(post) },
                        colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFF3B82F6))
                    ) {
                        Text("🔗 Visit", fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReactionButton(
    emoji: String,
    count: Int,
    isActive: Boolean,
    activeColor: Color,
    onClick: () -> Unit
) {
    TextButton(
        onClick = onClick,
        colors = ButtonDefaults.textButtonColors(
            contentColor = if (isActive) activeColor else Color(0xFF6B7280)
        )
    ) {
        Text(
            "$emoji $count",
            fontSize = 13.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal
        )
    }
}

fun formatTimeAgo(value: String): String {
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        )
        var date: Date? = null
        for (fmt in formats) {
            fmt.timeZone = TimeZone.getTimeZone("UTC")
            try {
                date = fmt.parse(value)
                if (date != null) break
            } catch (_: Exception) {}
        }
        if (date == null) return ""

        val now = Date()
        val diffMs = now.time - date.time
        val diffMinutes = diffMs / (1000 * 60)
        val diffHours = diffMs / (1000 * 60 * 60)
        val diffDays = diffMs / (1000 * 60 * 60 * 24)

        when {
            diffDays >= 7 -> {
                val sdf = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US)
                sdf.format(date)
            }
            diffDays >= 1 -> "${diffDays}d ago"
            diffHours >= 1 -> "${diffHours}h ago"
            diffMinutes >= 1 -> "${diffMinutes}m ago"
            else -> "just now"
        }
    } catch (_: Exception) { "" }
}