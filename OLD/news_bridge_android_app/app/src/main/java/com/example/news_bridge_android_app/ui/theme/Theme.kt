package com.example.news_bridge_android_app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Category colors matching web frontend
object CategoryColors {
    val General = CategoryColorSet(Color(0xFF6B7280), Color(0xFF9CA3AF))
    val Politics = CategoryColorSet(Color(0xFF2563EB), Color(0xFF60A5FA))
    val Sports = CategoryColorSet(Color(0xFFF97316), Color(0xFFFB923C))
    val Finance = CategoryColorSet(Color(0xFF16A34A), Color(0xFF4ADE80))
    val Medical = CategoryColorSet(Color(0xFFDC2626), Color(0xFFF87171))
    val Tech = CategoryColorSet(Color(0xFF06B6D4), Color(0xFF22D3EE))
    val Culture = CategoryColorSet(Color(0xFF9333EA), Color(0xFFA855F7))
    val Religion = CategoryColorSet(Color(0xFFD97706), Color(0xFFFBBF24))

    fun getColors(category: String): CategoryColorSet {
        return when (category) {
            "Politics" -> Politics
            "Sports" -> Sports
            "Finance" -> Finance
            "Medical" -> Medical
            "Tech" -> Tech
            "Culture" -> Culture
            "Religion" -> Religion
            else -> General
        }
    }
}

data class CategoryColorSet(val primary: Color, val light: Color)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF0F6C8F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFB3E5FC),
    secondary = Color(0xFFE87526),
    background = Color(0xFFEDF4F7),
    surface = Color.White,
    surfaceVariant = Color(0xFFF6FBFD),
    onBackground = Color(0xFF13293D),
    onSurface = Color(0xFF13293D),
    outline = Color(0xFFD5E0E8)
)

@Composable
fun NewsBridgeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) darkColorScheme(
        primary = Color(0xFF4FC3F7),
        onPrimary = Color(0xFF003544),
        background = Color(0xFF121212),
        surface = Color(0xFF1E1E1E),
        onBackground = Color(0xFFE0E0E0),
        onSurface = Color(0xFFE0E0E0)
    ) else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}