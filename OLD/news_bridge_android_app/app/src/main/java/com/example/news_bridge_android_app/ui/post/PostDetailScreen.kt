package com.example.news_bridge_android_app.ui.post

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.news_bridge_android_app.data.model.ContentItem
import com.example.news_bridge_android_app.data.model.MediaItem
import com.example.news_bridge_android_app.data.model.Post
import com.example.news_bridge_android_app.ui.theme.CategoryColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailScreen(
    viewModel: PostDetailViewModel,
    onBack: () -> Unit,
    onOpenComments: (Post) -> Unit,
    onAskAI: (Post) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val post = uiState.post ?: return
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        post.title ?: "Post Detail",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("← Back", color = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CategoryColors.getColors(post.label).primary
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Category label
            val colors = CategoryColors.getColors(post.label)
            Text(
                text = post.label,
                color = colors.primary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )

            // Title
            post.title?.let {
                Text(
                    text = it,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            // Meta info
            Row(
                modifier = Modifier.padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                post.lang?.let {
                    Text(
                        text = it,
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Content
            if (uiState.isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
            } else {
                val contentItems = uiState.content.content
                if (contentItems.isEmpty()) {
                    // Fallback to post text
                    post.text?.let { text ->
                        Text(
                            text = text,
                            fontSize = 16.sp,
                            color = Color(0xFF374151),
                            lineHeight = 28.sp
                        )
                    }
                } else {
                    contentItems.forEach { item ->
                        when (item.type) {
                            "paragraph" -> {
                                item.text?.let { text ->
                                    Text(
                                        text = text,
                                        fontSize = 16.sp,
                                        color = Color(0xFF374151),
                                        lineHeight = 28.sp,
                                        modifier = Modifier.padding(bottom = 12.dp)
                                    )
                                }
                            }
                            "media" -> {
                                item.url?.let { url ->
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 8.dp),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        if (item.mediaType == "video") {
                                            Text(
                                                text = "🎬 Video content",
                                                modifier = Modifier.padding(16.dp),
                                                color = Color.Gray
                                            )
                                        } else {
                                            AsyncImage(
                                                model = url,
                                                contentDescription = "Media",
                                                modifier = Modifier.fillMaxWidth()
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Media gallery
            if (uiState.media.isNotEmpty()) {
                Text(
                    text = "Media Gallery",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                uiState.media.forEach { mediaItem ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (mediaItem.type == "video") {
                            Text(
                                text = "🎬 ${mediaItem.url}",
                                modifier = Modifier.padding(16.dp),
                                color = Color.Gray
                            )
                        } else {
                            AsyncImage(
                                model = mediaItem.url,
                                contentDescription = "Post media",
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Tags
            if (post.tags.isNotEmpty()) {
                Text(
                    text = "Tags",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    post.tags.forEach { tag ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFE5E7EB)
                        ) {
                            Text(
                                text = "#$tag",
                                fontSize = 12.sp,
                                color = Color(0xFF374151),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Reaction buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Button(
                    onClick = { viewModel.react("LIKE") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (uiState.userReaction == "LIKE") Color(0xFF3B82F6) else Color(0xFFE5E7EB),
                        contentColor = if (uiState.userReaction == "LIKE") Color.White else Color(0xFF374151)
                    )
                ) {
                    Text("👍 ${uiState.likesCount}")
                }

                Button(
                    onClick = { viewModel.react("DISLIKE") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (uiState.userReaction == "DISLIKE") Color(0xFFEF4444) else Color(0xFFE5E7EB),
                        contentColor = if (uiState.userReaction == "DISLIKE") Color.White else Color(0xFF374151)
                    )
                ) {
                    Text("👎 ${uiState.dislikesCount}")
                }

                OutlinedButton(onClick = { onOpenComments(post) }) {
                    Text("💬 Comment")
                }

                Button(
                    onClick = { onAskAI(post) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF9333EA),
                        contentColor = Color.White
                    )
                ) {
                    Text("✨ Ask AI")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Visit original article button
            post.articleUrl?.let { url ->
                Button(
                    onClick = {
                        viewModel.recordClick()
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF2563EB)
                    )
                ) {
                    Text("Visit Original Article", color = Color.White)
                }
            }
        }
    }
}