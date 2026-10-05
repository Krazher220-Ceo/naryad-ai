package kz.naryadai.app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kz.naryadai.app.NaryadApplication
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.AccentYellow
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.CanvasBg
import kz.naryadai.app.ui.theme.DangerRed
import kz.naryadai.app.ui.theme.DangerSoft
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InkPrimary
import kz.naryadai.app.ui.theme.LineBorder
import kz.naryadai.app.ui.theme.SurfaceWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onSignOutSuccess: () -> Unit
) {
    val context = LocalContext.current
    val app = NaryadApplication.get(context)
    val session = app.sessionManager
    val repo = app.orderRepository
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val pendingCount by repo.offlineQueueCount.collectAsState(initial = 0)
    var isSyncing by remember { mutableStateOf(false) }
    var currentLang by remember { mutableStateOf(session.language) }

    fun switchLanguage(lang: String) {
        currentLang = lang
        session.language = lang
        app.applyLocale(lang)
    }

    val initials = remember(session.employeeName) {
        val parts = (session.employeeName ?: "И").trim().split("\\s+".toRegex())
        parts.take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("")
    }

    val roleName = when (session.employeeRole) {
        "worker" -> stringResource(R.string.role_worker)
        "master" -> stringResource(R.string.role_master)
        "lead" -> stringResource(R.string.role_lead)
        "operator" -> stringResource(R.string.role_operator)
        else -> stringResource(R.string.role_worker)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.profile_title),
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BrandNavy)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = CanvasBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Карточка пользователя
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(BrandNavy),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initials,
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Column {
                        Text(
                            text = session.employeeName ?: stringResource(R.string.role_worker),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = InkPrimary
                        )
                        Text(
                            text = roleName,
                            fontSize = 15.sp,
                            color = InkMuted
                        )
                    }
                }
            }

            // Выбор языка
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Language,
                            contentDescription = null,
                            tint = BrandNavy
                        )
                        Text(
                            text = stringResource(R.string.profile_language),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = InkPrimary
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val isRu = currentLang == "ru"
                        Button(
                            onClick = { switchLanguage("ru") },
                            modifier = Modifier
                                .weight(1f)
                                .height(52.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isRu) BrandNavy else CanvasBg,
                                contentColor = if (isRu) Color.White else InkPrimary
                            )
                        ) {
                            Text(stringResource(R.string.profile_lang_ru), fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { switchLanguage("kk") },
                            modifier = Modifier
                                .weight(1f)
                                .height(52.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (!isRu) BrandNavy else CanvasBg,
                                contentColor = if (!isRu) Color.White else InkPrimary
                            )
                        ) {
                            Text(stringResource(R.string.profile_lang_kk), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Очередь офлайн-действий
            if (pendingCount > 0) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.profile_offline_queue, pendingCount),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = InkPrimary
                        )

                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    isSyncing = true
                                    val count = repo.syncOfflineQueue().getOrDefault(0)
                                    isSyncing = false
                                    snackbarHostState.showSnackbar("Синхронизировано действий: $count")
                                }
                            },
                            enabled = !isSyncing,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            if (isSyncing) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(imageVector = Icons.Default.Sync, contentDescription = null)
                                Spacer(modifier = Modifier.size(8.dp))
                                Text(stringResource(R.string.profile_sync_now))
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Кнопка выхода (56dp min)
            OutlinedButton(
                onClick = {
                    scope.launch {
                        app.supabaseManager.signOut()
                        onSignOutSuccess()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .testTag("sign_out_button"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = DangerRed
                ),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = androidx.compose.ui.graphics.SolidColor(DangerRed)
                )
            ) {
                Text(
                    text = stringResource(R.string.auth_sign_out),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
