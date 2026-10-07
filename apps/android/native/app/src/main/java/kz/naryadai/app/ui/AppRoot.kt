// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.data.ActionResult
import kz.naryadai.app.notify.DeepLink
import kz.naryadai.app.notify.WorkerService
import kz.naryadai.app.ui.components.AppSnackbarHost
import kz.naryadai.app.ui.components.showResult
import kz.naryadai.app.ui.screens.CompleteScreen
import kz.naryadai.app.ui.screens.DetailScreen
import kz.naryadai.app.ui.screens.LoginScreen
import kz.naryadai.app.ui.screens.NotificationsScreen
import kz.naryadai.app.ui.screens.OrdersScreen
import kz.naryadai.app.ui.screens.ProfileScreen
import kz.naryadai.app.ui.theme.Accent
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.Surface

private const val LOGIN = "login"
private const val ORDERS = "orders"
private const val NOTIFICATIONS = "notifications"
private const val PROFILE = "profile"
private const val ORDER = "order/{orderId}"
private const val COMPLETE = "complete/{orderId}"

@Composable
fun AppRoot() {
    val nav = rememberNavController()
    val employee by Graph.session.employee.collectAsState()
    val loggedIn = employee != null
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Вход и выход переключают экран сами: нет сессии — вход, есть — наряды
    LaunchedEffect(loggedIn) {
        val target = if (loggedIn) ORDERS else LOGIN
        val current = nav.currentDestination?.route
        if (current != target && (!loggedIn || current == LOGIN)) {
            nav.navigate(target) { popUpTo(0) { inclusive = true } }
        }
    }

    // Нажатие на уведомление: открываем наряд или список уведомлений
    val deepLink by DeepLink.target.collectAsState()
    LaunchedEffect(deepLink, loggedIn, route) {
        val target = deepLink
        if (target != null && loggedIn && route != null && route != LOGIN) {
            DeepLink.target.value = null
            nav.navigate(target) { launchSingleTop = true }
        }
    }

    // Уведомления: один раз объясняем, зачем они, и просим разрешение (Android 13+).
    // Службу с «живым» уведомлением держим, пока исполнитель вошёл и уведомления разрешены.
    val context = LocalContext.current
    var askNotif by remember { mutableStateOf(false) }
    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) WorkerService.start(context)
    }
    LaunchedEffect(loggedIn) {
        if (loggedIn && Build.VERSION.SDK_INT >= 33 && !Graph.session.notifAsked &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) askNotif = true
    }
    LifecycleResumeEffect(loggedIn) {
        if (loggedIn) WorkerService.start(context) else WorkerService.stop(context)
        onPauseOrDispose { }
    }

    // Обновление данных каждые 20 секунд, пока приложение на экране (и при возвращении в него)
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(loggedIn) {
        if (loggedIn) {
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    Graph.repo.refreshAll()
                    delay(20_000)
                }
            }
        }
    }

    // Сообщения фоновой отправки (сервер отказал в сохранённом действии)
    LaunchedEffect(Unit) {
        Graph.repo.messages.collect { snackbar.showSnackbar(it) }
    }

    val sentForReview = stringResource(R.string.toast_sent_for_review)
    val offlineText = stringResource(R.string.toast_offline)

    if (askNotif) {
        AlertDialog(
            onDismissRequest = { },
            title = { Text(stringResource(R.string.notif_ask_title), style = MaterialTheme.typography.titleMedium) },
            text = { Text(stringResource(R.string.notif_ask_text), style = MaterialTheme.typography.bodyLarge) },
            confirmButton = {
                TextButton(
                    onClick = {
                        askNotif = false
                        Graph.session.notifAsked = true
                        notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    },
                    modifier = Modifier.padding(4.dp),
                ) { Text(stringResource(R.string.notif_ask_yes), style = MaterialTheme.typography.labelLarge) }
            },
            dismissButton = {
                TextButton(onClick = { askNotif = false; Graph.session.notifAsked = true }, modifier = Modifier.padding(4.dp)) {
                    Text(stringResource(R.string.notif_ask_later), style = MaterialTheme.typography.labelLarge)
                }
            },
            containerColor = Color.White,
        )
    }

    Box(Modifier.fillMaxSize().background(Canvas)) {
        Column(Modifier.fillMaxSize()) {
            NavHost(
                navController = nav,
                startDestination = if (loggedIn) ORDERS else LOGIN,
                modifier = Modifier.weight(1f),
            ) {
                composable(LOGIN) { LoginScreen() }
                composable(ORDERS) { OrdersScreen(onOpen = { nav.navigate("order/$it") }) }
                composable(NOTIFICATIONS) { NotificationsScreen(onOpenOrder = { nav.navigate("order/$it") }) }
                composable(PROFILE) { ProfileScreen() }
                composable(ORDER, arguments = listOf(navArgument("orderId") { type = NavType.StringType })) {
                    DetailScreen(
                        onBack = { nav.popBackStack() },
                        onComplete = { nav.navigate("complete/$it") },
                    )
                }
                composable(COMPLETE, arguments = listOf(navArgument("orderId") { type = NavType.StringType })) {
                    CompleteScreen(
                        onBack = { nav.popBackStack() },
                        onDone = { result ->
                            nav.popBackStack(ORDERS, inclusive = false)
                            scope.launch { snackbar.showResult(result, sentForReview, offlineText) }
                        },
                    )
                }
            }
            // На экранах одного наряда нижнего меню нет
            if (route == ORDERS || route == NOTIFICATIONS || route == PROFILE) {
                BottomNav(nav, route)
            }
        }
        AppSnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = if (route == ORDER || route == COMPLETE) 160.dp else 96.dp))
    }
}

// Нижнее меню: три кнопки, средняя крупная и приподнята (как на сайте)
@Composable
private fun BottomNav(nav: NavHostController, route: String?) {
    val unread = Graph.repo.notifications.collectAsState().value.count { it.readAt == null }
    Column(Modifier.fillMaxWidth().background(Surface).navigationBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Line))
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.Bottom) {
            NavSide(Icons.Filled.Assignment, stringResource(R.string.nav_orders), route == ORDERS, Modifier.weight(1f)) { go(nav, ORDERS) }
            // Средняя кнопка
            Column(
                Modifier.weight(1f).height(84.dp).clickable { go(nav, NOTIFICATIONS) },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.offset(y = (-20).dp).size(64.dp)) {
                    Box(
                        Modifier.size(64.dp).border(4.dp, Canvas, RoundedCornerShape(20.dp)).background(Brand, RoundedCornerShape(20.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Notifications, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
                    }
                    if (unread > 0) {
                        Box(
                            Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = (-4).dp).size(26.dp).background(Danger, CircleShape).border(2.dp, Color.White, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(if (unread > 9) "9+" else unread.toString(), color = Color.White, fontSize = 13.sp, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
                Text(
                    stringResource(R.string.nav_notifications),
                    modifier = Modifier.offset(y = (-14).dp),
                    maxLines = 1,
                    softWrap = false,
                    style = MaterialTheme.typography.labelMedium.copy(fontSize = 13.sp),
                    color = if (route == NOTIFICATIONS) Brand else Ink,
                )
            }
            NavSide(Icons.Filled.Person, stringResource(R.string.nav_profile), route == PROFILE, Modifier.weight(1f)) { go(nav, PROFILE) }
        }
    }
}

@Composable
private fun NavSide(icon: ImageVector, label: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.height(72.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Brand else InkMuted, modifier = Modifier.size(28.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 13.sp, fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.SemiBold),
            color = if (selected) Brand else InkMuted,
        )
    }
}

private fun go(nav: NavHostController, route: String) {
    nav.navigate(route) {
        popUpTo(ORDERS) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
