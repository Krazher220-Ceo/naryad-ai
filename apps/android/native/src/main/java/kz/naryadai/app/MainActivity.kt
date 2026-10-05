package kz.naryadai.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import kz.naryadai.app.ui.navigation.AppNavGraph
import kz.naryadai.app.ui.theme.CanvasBg
import kz.naryadai.app.ui.theme.NaryadTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = NaryadApplication.get(this)
        val isLoggedIn = app.sessionManager.isLoggedIn()

        setContent {
            NaryadTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = CanvasBg
                ) {
                    AppNavGraph(isLoggedIn = isLoggedIn)
                }
            }
        }
    }
}
