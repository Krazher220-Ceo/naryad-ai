package kz.naryadai.app.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import kz.naryadai.app.R
import kz.naryadai.app.ui.screens.complete.CompleteOrderScreen
import kz.naryadai.app.ui.screens.detail.OrderDetailScreen
import kz.naryadai.app.ui.screens.login.LoginScreen
import kz.naryadai.app.ui.screens.notifications.NotificationsScreen
import kz.naryadai.app.ui.screens.orders.OrdersScreen
import kz.naryadai.app.ui.screens.profile.ProfileScreen
import kz.naryadai.app.ui.theme.AccentYellow
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.SurfaceWhite

sealed class Screen(val route: String, val titleRes: Int? = null, val icon: ImageVector? = null) {
    data object Login : Screen("login")
    data object Orders : Screen("orders", R.string.nav_my_orders, Icons.Default.Assignment)
    data object Notifications : Screen("notifications", R.string.nav_notifications, Icons.Default.Notifications)
    data object Profile : Screen("profile", R.string.nav_profile, Icons.Default.Person)
    data object OrderDetail : Screen("order_detail/{orderId}") {
        fun createRoute(orderId: String) = "order_detail/$orderId"
    }
    data object CompleteOrder : Screen("order_complete/{orderId}") {
        fun createRoute(orderId: String) = "order_complete/$orderId"
    }
}

val BOTTOM_NAV_ITEMS = listOf(
    Screen.Orders,
    Screen.Notifications,
    Screen.Profile
)

@Composable
fun AppNavGraph(
    isLoggedIn: Boolean,
    navController: NavHostController = rememberNavController()
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val showBottomBar = currentRoute in listOf(
        Screen.Orders.route,
        Screen.Notifications.route,
        Screen.Profile.route
    )

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = SurfaceWhite,
                    contentColor = BrandNavy
                ) {
                    BOTTOM_NAV_ITEMS.forEach { item ->
                        val selected = currentRoute == item.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                item.icon?.let {
                                    Icon(
                                        imageVector = it,
                                        contentDescription = item.titleRes?.let { res -> stringResource(res) }
                                    )
                                }
                            },
                            label = {
                                item.titleRes?.let {
                                    Text(
                                        text = stringResource(it),
                                        fontSize = 12.sp,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = BrandNavy,
                                selectedTextColor = BrandNavy,
                                indicatorColor = BrandNavy.copy(alpha = 0.1f),
                                unselectedIconColor = InkMuted,
                                unselectedTextColor = InkMuted
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = if (isLoggedIn) Screen.Orders.route else Screen.Login.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Orders.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Orders.route) {
                OrdersScreen(
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    }
                )
            }

            composable(Screen.Notifications.route) {
                NotificationsScreen(
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    }
                )
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    onSignOutSuccess = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            composable(
                route = Screen.OrderDetail.route,
                arguments = listOf(navArgument("orderId") { type = NavType.StringType })
            ) { backStackEntry ->
                val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
                OrderDetailScreen(
                    orderId = orderId,
                    onBackClick = { navController.popBackStack() },
                    onNavigateToComplete = { id ->
                        navController.navigate(Screen.CompleteOrder.createRoute(id))
                    }
                )
            }

            composable(
                route = Screen.CompleteOrder.route,
                arguments = listOf(navArgument("orderId") { type = NavType.StringType })
            ) { backStackEntry ->
                val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
                CompleteOrderScreen(
                    orderId = orderId,
                    onBackClick = { navController.popBackStack() },
                    onCompleteSuccess = {
                        navController.popBackStack(Screen.Orders.route, inclusive = false)
                    }
                )
            }
        }
    }
}
