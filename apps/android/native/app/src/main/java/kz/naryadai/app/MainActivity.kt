package kz.naryadai.app

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import android.graphics.Color
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import kz.naryadai.app.ui.AppRoot
import kz.naryadai.app.ui.theme.NaryadTheme
import java.util.Locale

// Контекст, у которого строки берутся на выбранном языке (ru или kk)
private class LocalizedContext(base: Context, private val localizedResources: Resources) : ContextWrapper(base) {
    override fun getResources(): Resources = localizedResources
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent {
            val language by Graph.session.language.collectAsState()
            val config = remember(language) {
                Configuration(resources.configuration).apply { setLocale(Locale(language)) }
            }
            val localized = remember(config) { LocalizedContext(this, createConfigurationContext(config).resources) }
            CompositionLocalProvider(
                LocalContext provides localized,
                LocalConfiguration provides config,
            ) {
                NaryadTheme { AppRoot() }
            }
        }
    }
}
