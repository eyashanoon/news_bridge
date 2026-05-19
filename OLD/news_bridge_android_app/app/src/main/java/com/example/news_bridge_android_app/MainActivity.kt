package com.example.news_bridge_android_app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.news_bridge_android_app.data.local.TokenManager
import com.example.news_bridge_android_app.data.remote.RetrofitClient
import com.example.news_bridge_android_app.data.repository.NewsRepository
import com.example.news_bridge_android_app.ui.comments.CommentsScreen
import com.example.news_bridge_android_app.ui.comments.CommentsViewModel
import com.example.news_bridge_android_app.ui.chat.ChatScreen
import com.example.news_bridge_android_app.ui.chat.ChatViewModel
import com.example.news_bridge_android_app.ui.feed.FeedScreen
import com.example.news_bridge_android_app.ui.feed.FeedViewModel
import com.example.news_bridge_android_app.ui.navigation.NavRoutes
import com.example.news_bridge_android_app.ui.post.PostDetailScreen
import com.example.news_bridge_android_app.ui.post.PostDetailViewModel
import com.example.news_bridge_android_app.ui.theme.NewsBridgeTheme

class MainActivity : ComponentActivity() {

    private lateinit var tokenManager: TokenManager
    private lateinit var repository: NewsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize core dependencies
        tokenManager = TokenManager(applicationContext)
        RetrofitClient.init(tokenManager)
        repository = NewsRepository(tokenManager)

        enableEdgeToEdge()
        setContent {
            NewsBridgeTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavigation(repository)
                }
            }
        }
    }
}

@Composable
fun AppNavigation(repository: NewsRepository) {
    val navController = rememberNavController()
    val context = LocalContext.current

    // Create ViewModels with factory pattern
    val feedViewModel: FeedViewModel = viewModel(
        factory = object : androidx.lifecycle.ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                return FeedViewModel(repository) as T
            }
        }
    )

    NavHost(navController = navController, startDestination = NavRoutes.FEED) {
        composable(NavRoutes.FEED) {
            FeedScreen(
                viewModel = feedViewModel,
                onPostClick = { post ->
                    navController.navigate(NavRoutes.postDetail(post.id))
                },
                onCommentClick = { post ->
                    navController.navigate(NavRoutes.comments(post.id))
                },
                onAskAI = { post ->
                    navController.navigate(NavRoutes.aiChat(post.id))
                },
                onVisitClick = { post ->
                    post.articleUrl?.let { url ->
                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                        context.startActivity(intent)
                    }
                }
            )
        }

        composable(
            route = NavRoutes.POST_DETAIL,
            arguments = listOf(navArgument("postId") { type = NavType.LongType })
        ) { backStackEntry ->
            val postId = backStackEntry.arguments?.getLong("postId") ?: return@composable
            val post = feedViewModel.uiState.value.posts.find { it.id == postId }

            val detailViewModel: PostDetailViewModel = viewModel(
                factory = object : androidx.lifecycle.ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                        return PostDetailViewModel(repository) as T
                    }
                }
            )

            LaunchedEffect(postId) {
                post?.let { detailViewModel.loadPost(it) }
            }

            PostDetailScreen(
                viewModel = detailViewModel,
                onBack = { navController.popBackStack() },
                onOpenComments = { p ->
                    navController.navigate(NavRoutes.comments(p.id))
                },
                onAskAI = { p ->
                    navController.navigate(NavRoutes.aiChat(p.id))
                }
            )
        }

        composable(
            route = NavRoutes.COMMENTS,
            arguments = listOf(navArgument("postId") { type = NavType.LongType })
        ) { backStackEntry ->
            val postId = backStackEntry.arguments?.getLong("postId") ?: return@composable
            val post = feedViewModel.uiState.value.posts.find { it.id == postId }

            val commentsViewModel: CommentsViewModel = viewModel(
                factory = object : androidx.lifecycle.ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                        return CommentsViewModel(repository) as T
                    }
                }
            )

            LaunchedEffect(postId) {
                post?.let { commentsViewModel.loadComments(it) }
            }

            CommentsScreen(
                viewModel = commentsViewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = NavRoutes.AI_CHAT,
            arguments = listOf(navArgument("postId") { type = NavType.LongType })
        ) { backStackEntry ->
            val postId = backStackEntry.arguments?.getLong("postId") ?: return@composable
            val post = feedViewModel.uiState.value.posts.find { it.id == postId }

            val chatViewModel: ChatViewModel = viewModel(
                factory = object : androidx.lifecycle.ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                        return ChatViewModel(repository) as T
                    }
                }
            )

            LaunchedEffect(postId) {
                post?.let { chatViewModel.loadPost(it) }
            }

            ChatScreen(
                viewModel = chatViewModel,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
