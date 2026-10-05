package kz.naryadai.app.ui.screens.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kz.naryadai.app.NaryadApplication
import kz.naryadai.app.R
import kz.naryadai.app.data.model.WorkOrder
import kz.naryadai.app.ui.components.OfflineBanner
import kz.naryadai.app.ui.components.OverdueTag
import kz.naryadai.app.ui.components.PriorityBadge
import kz.naryadai.app.ui.components.StatusBadge
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.CanvasBg
import kz.naryadai.app.ui.theme.DangerRed
import kz.naryadai.app.ui.theme.DangerSoft
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InkPrimary
import kz.naryadai.app.ui.theme.LineBorder
import kz.naryadai.app.ui.theme.SurfaceWhite
import kz.naryadai.app.util.NetworkUtils
import java.time.Duration
import java.time.Instant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    onOrderClick: (orderId: String) -> Unit
) {
    val context = LocalContext.current
    val app = NaryadApplication.get(context)
    val repo = app.orderRepository
    val scope = rememberCoroutineScope()

    val orders by repo.ordersFlow.collectAsState(initial = emptyList())
    val offlineCount by repo.offlineQueueCount.collectAsState(initial = 0)
    var isRefreshing by remember { mutableStateOf(false) }
    var isOnline by remember { mutableStateOf(NetworkUtils.isOnline(context)) }

    fun refresh() {
        scope.launch {
            isOnline = NetworkUtils.isOnline(context)
            isRefreshing = true
            repo.refreshOrders()
            isRefreshing = false
        }
    }

    LaunchedEffect(Unit) {
        refresh()
        // Слушаем Realtime
        app.supabaseManager.subscribeToRealtime(scope) {
            refresh()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.nav_my_orders),
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = Color.White
                    )
                },
                actions = {
                    IconButton(
                        onClick = { refresh() },
                        enabled = !isRefreshing
                    ) {
                        if (isRefreshing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = stringResource(R.string.action_retry),
                                tint = Color.White
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BrandNavy
                )
            )
        },
        containerColor = CanvasBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            OfflineBanner(
                isOffline = !isOnline,
                pendingCount = offlineCount
            )

            if (orders.isEmpty() && !isRefreshing) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Assignment,
                            contentDescription = null,
                            tint = InkMuted,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = stringResource(R.string.empty_orders_title),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = InkPrimary
                        )
                        Text(
                            text = stringResource(R.string.empty_orders_desc),
                            fontSize = 14.sp,
                            color = InkMuted
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("orders_list"),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(orders, key = { it.id }) { order ->
                        OrderCardItem(
                            order = order,
                            onClick = { onOrderClick(order.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun OrderCardItem(
    order: WorkOrder,
    onClick: () -> Unit
) {
    val isEmergency = order.priority == "emergency"

    val minutesLate = remember(order.dueAt, order.overdue) {
        if (!order.overdue) 0L
        else {
            try {
                val due = Instant.parse(order.dueAt)
                val diff = Duration.between(due, Instant.now()).toMinutes()
                diff.coerceAtLeast(0L)
            } catch (e: Exception) {
                0L
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .then(
                if (isEmergency) Modifier.border(2.dp, DangerRed, RoundedCornerShape(16.dp))
                else Modifier.border(1.dp, LineBorder, RoundedCornerShape(16.dp))
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isEmergency) DangerSoft.copy(alpha = 0.3f) else SurfaceWhite
        ),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Верхняя строка: номер, бейджи статуса и приоритета
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.order_number_prefix, order.number),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = if (isEmergency) DangerRed else InkPrimary
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    PriorityBadge(priority = order.priority)
                    StatusBadge(status = order.status)
                    if (order.overdue) {
                        OverdueTag(minutesLate = minutesLate)
                    }
                }
            }

            // Описание (максимум 2 строки)
            Text(
                text = order.description,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = InkPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            // Оборудование · Участок
            val eqSection = buildString {
                order.equipmentName?.let { append(it) }
                if (!order.equipmentName.isNullOrBlank() && !order.sectionName.isNullOrBlank()) {
                    append(" · ")
                }
                order.sectionName?.let { append(it) }
            }
            if (eqSection.isNotBlank()) {
                Text(
                    text = eqSection,
                    fontSize = 14.sp,
                    color = InkMuted
                )
            }

            // Срок и исполнитель
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (order.dueAt.isNotBlank()) {
                    val formattedDate = try {
                        order.dueAt.replace("T", " ").take(16)
                    } catch (e: Exception) {
                        order.dueAt
                    }
                    Text(
                        text = stringResource(R.string.order_due_prefix, formattedDate),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (order.overdue) DangerRed else InkMuted
                    )
                }

                if (!order.assigneeName.isNullOrBlank()) {
                    Text(
                        text = order.assigneeName,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = InkMuted
                    )
                }
            }
        }
    }
}
