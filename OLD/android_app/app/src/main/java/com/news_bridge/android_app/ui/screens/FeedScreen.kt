package com.news_bridge.android_app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.newsbridge.app.R
import com.news_bridge.android_app.ui.components.PostCard
import com.news_bridge.android_app.viewmodel.FeedState
import com.news_bridge.android_app.viewmodel.FeedViewModel

@Composable
fun FeedScreen(viewModel: FeedViewModel) {

    val state by viewModel.feedState.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(14.dp)) {

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = stringResource(R.string.feed),
                style = MaterialTheme.typography.headlineSmall
            )

            Button(onClick = { viewModel.loadFeed() }) {
                Text(stringResource(R.string.refresh))
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        when (state) {
            is FeedState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    CircularProgressIndicator()
                }
            }

            is FeedState.Error -> {
                val msg = (state as FeedState.Error).message
                Text("${stringResource(R.string.error)}: $msg")
                Spacer(modifier = Modifier.height(12.dp))
                Button(onClick = { viewModel.loadFeed() }) {
                    Text(stringResource(R.string.retry))
                }
            }

            is FeedState.Success -> {
                val posts = (state as FeedState.Success).posts

                LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(posts) { post ->
                        PostCard(post)
                    }
                }
            }
        }
    }
}