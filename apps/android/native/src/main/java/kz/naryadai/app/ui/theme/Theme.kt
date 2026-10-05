package kz.naryadai.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = BrandNavy,
    onPrimary = Color.White,
    primaryContainer = BrandNavyHover,
    onPrimaryContainer = Color.White,
    secondary = AccentYellow,
    onSecondary = InkPrimary,
    background = CanvasBg,
    onBackground = InkPrimary,
    surface = SurfaceWhite,
    onSurface = InkPrimary,
    surfaceVariant = CanvasBg,
    onSurfaceVariant = InkMuted,
    outline = LineBorder,
    error = DangerRed,
    onError = Color.White,
    errorContainer = DangerSoft,
    onErrorContainer = DangerRed
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF6B9BFF),
    onPrimary = Color.Black,
    secondary = AccentYellow,
    onSecondary = Color.Black,
    background = BrandNavyDark,
    onBackground = Color.White,
    surface = Color(0xFF071F43),
    onSurface = Color.White,
    outline = LineBorderStrong,
    error = Color(0xFFFFB4AB),
    onError = Color.Black
)

@Composable
fun NaryadTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
