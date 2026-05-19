package com.example.news_bridge_android_app.ui.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
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
import com.example.news_bridge_android_app.data.model.Post
import com.example.news_bridge_android_app.ui.components.PostCard
import com.example.news_bridge_android_app.ui.theme.CategoryColors
import kotlinx.coroutines.launch

// Categories matching web frontend
val categories = listOf(
    "General" to Color(0xFF6B7280),
    "Politics" to Color(0xFF2563EB),
    "Sports" to Color(0xFFF97316),
    "Finance" to Color(0xFF16A34A),
    "Medical" to Color(0xFFDC2626),
    "Tech" to Color(0xFF06B6D4),
    "Culture" to Color(0xFF9333EA),
    "Religion" to Color(0xFFD97706)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    viewModel: FeedViewModel,
    onPostClick: (Post) -> Unit,
    onCommentClick: (Post) -> Unit,
    onVisitClick: (Post) -> Unit,
    onAskAI: (Post) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    // Trigger load more when reaching the end
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisibleItem = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisibleItem >= listState.layoutInfo.totalItemsCount - 3 && uiState.hasMore && !uiState.isLoadingMore
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            viewModel.loadFeed()
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.width(280.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Categories",
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                HorizontalDivider()
                categories.forEach { (name, color) ->
                    NavigationDrawerItem(
                        label = { Text(name) },
                        selected = uiState.currentCategory == name,
                        onClick = {
                            viewModel.selectCategory(name)
                            scope.launch { drawerState.close() }
                        },
                        icon = {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .background(color, CircleShape)
                            )
                        },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                    )
                }
                
                Spacer(modifier = Modifier.weight(1f))
                HorizontalDivider()
                
                // Location Option in Drawer
                NavigationDrawerItem(
                    label = { 
                        Column {
                            Text("Location")
                            Text(
                                uiState.selectedLocation?.let { "${it.lat}, ${it.lon}" } ?: "Global",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.Gray
                            )
                        }
                    },
                    selected = false,
                    onClick = {
                        // In a real app, open location picker
                        // For now, toggle a dummy location
                        if (uiState.selectedLocation == null) {
                            viewModel.setLocation(com.example.news_bridge_android_app.data.model.LocationData("New York", 40.7128, -74.0060))
                        } else {
                            viewModel.setLocation(null)
                        }
                        scope.launch { drawerState.close() }
                    },
                    icon = { Text("📍") },
                    modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                )
                
                // Ask AI Option in Drawer
                NavigationDrawerItem(
                    label = { Text("Ask AI Assistant") },
                    selected = false,
                    onClick = {
                        uiState.posts.firstOrNull()?.let { onAskAI(it) }
                        scope.launch { drawerState.close() }
                    },
                    icon = { Text("✨") },
                    modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            "AI News Bridge",
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Text("☰", color = Color.White, fontSize = 24.sp)
                        }
                    },
                    actions = {
                        IconButton(onClick = { 
                            // General Ask AI action - maybe open with no specific post
                            uiState.posts.firstOrNull()?.let { onAskAI(it) }
                        }) {
                            Text("✨", fontSize = 20.sp)
                        }
                        IconButton(onClick = { 
                            if (uiState.selectedLocation == null) {
                                viewModel.setLocation(com.example.news_bridge_android_app.data.model.LocationData("New York", 40.7128, -74.0060))
                            } else {
                                viewModel.setLocation(null)
                            }
                        }) {
                            Text(if (uiState.selectedLocation != null) "📍" else "🌍", fontSize = 20.sp)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = CategoryColors.getColors(uiState.currentCategory).primary,
                        titleContentColor = Color.White,
                        navigationIconContentColor = Color.White,
                        actionIconContentColor = Color.White
                    )
                )
            },
            floatingActionButton = {
                ExtendedFloatingActionButton(
                    onClick = { 
                        uiState.posts.firstOrNull()?.let { onAskAI(it) }
                    },
                    icon = { Text("✨") },
                    text = { Text("Ask AI") },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = Color.White
                )
            }
        ) { paddingValues ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Left Bar (if on large screen, it would be permanent)
                // For mobile, we just have the drawer. 
                // But let's add a small vertical color bar as requested "bars to the left and right"
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .fillMaxHeight()
                        .background(CategoryColors.getColors(uiState.currentCategory).primary.copy(alpha = 0.3f))
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .background(MaterialTheme.colorScheme.background)
                ) {
                    // Category bar - horizontally scrollable
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.7f))
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        categories.forEach { (name, color) ->
                            val isSelected = uiState.currentCategory == name
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = if (isSelected) color else Color(0xFFE5E7EB),
                                onClick = { viewModel.selectCategory(name) }
                            ) {
                                Text(
                                    text = name,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) Color.White else Color(0xFF374151),
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }

                    // Feed content
                    when {
                        uiState.isLoading -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }
                        uiState.error != null && uiState.posts.isEmpty() -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        "Failed to load feed",
                                        color = Color.Gray,
                                        fontSize = 16.sp
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Button(onClick = { viewModel.refresh() }) {
                                        Text("Retry")
                                    }
                                }
                            }
                        }
                        uiState.posts.isEmpty() -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "No posts yet",
                                    color = Color.Gray,
                                    fontSize = 16.sp
                                )
                            }
                        }
                        else -> {
                            LazyColumn(
                                state = listState,
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(uiState.posts, key = { it.id }) { post ->
                                    PostCard(
                                        post = post,
                                        onPostClick = onPostClick,
                                        onCommentClick = onCommentClick,
                                        onVisitClick = onVisitClick,
                                        onReact = { p, type ->
                                            // Reaction is handled via PostCard's local state
                                        },
                                        onAskAI = onAskAI
                                    )
                                }

                                // Loading more indicator
                                if (uiState.isLoadingMore) {
                                    item {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(16.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(24.dp),
                                                strokeWidth = 2.dp
                                            )
                                        }
                                    }
                                }

                                // End of feed indicator
                                if (!uiState.hasMore && uiState.posts.isNotEmpty()) {
                                    item {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(16.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                "No more posts",
                                                color = Color.Gray,
                                                fontSize = 14.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Right Bar
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .fillMaxHeight()
                        .background(CategoryColors.getColors(uiState.currentCategory).primary.copy(alpha = 0.3f))
                )
            }
        }
    }
}
