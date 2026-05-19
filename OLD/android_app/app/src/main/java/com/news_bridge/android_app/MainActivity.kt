package com.news_bridge.android_app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import com.news_bridge.android_app.ui.screens.FeedScreen
import com.news_bridge.android_app.ui.theme.NewsBridgeTheme
import com.news_bridge.android_app.viewmodel.FeedViewModel


class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            NewsBridgeTheme {
                val feedViewModel: FeedViewModel = viewModel()
                FeedScreen(viewModel = feedViewModel)
            }
        }
    }
}