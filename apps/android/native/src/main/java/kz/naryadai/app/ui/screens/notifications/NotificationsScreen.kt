package kz.naryadai.app.ui.screens.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kz.naryadai.app.NaryadApplication
import kz.naryadai.app.R
import kz.naryadai.app.data.model.AppNotification
import kz.naryadai.app.ui.theme.AccentYellow
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.CanvasBg
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InkPrimary
import kz.naryadai.app.ui.theme.LineBorder
import kz.naryadai.app.ui.theme.SurfaceWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    onOrderClick: (orderId: String) -> Unit
) {
    val context = LocalContext.current
    val app = NaryadApplication.get(context)
    val repo = app.orderRepository
    val scope = rememberCoroutineScope()

    val notifications by repo.getNotificationsFlow().collectAsState(initial = emptyList())

    LaunchedEffect(Unit) {
        repo.refreshNotifications()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.notifications_title),
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                actions = {
                    IconButton(onClick = { scope.launch { repo.refreshNotifications() } }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = stringResource(R.string.action_retry),
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BrandNavy)
            )
        },
        containerColor = CanvasBg
    ) { innerPadding ->
        if (notifications.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.NotificationsNone,
                        contentDescription = null,
                        tint = InkMuted,
                        modifier = Modifier.size(48.dp)
                    )
                    Text(
                        text = stringResource(R.string.notifications_empty_title),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )
                    Text(
                        text = stringResource(R.string.notifications_empty_text),
                        fontSize = 14.sp,
                        color = InkMuted
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(notifications, key = { it.id }) { item ->
                    NotificationCard(
                        notification = item,
                        onClick = {
                            scope.launch { repo.markNotificationRead(item.id) }
                            item.orderId?.let { onOrderClick(it) }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun NotificationCard(
    notification: AppNotification,
    onClick: () -> Unit
) {
    val isUnread = notification.readAt.isNullOrBlank()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .border(
                width = if (isUnread) 2.dp else 1.dp,
                color = if (isUnread) BrandNavy else LineBorder,
                shape = RoundedCornerShape(14.dp)
            ),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isUnread) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(AccentYellow)
                        )
                    }
                    Text(
                        text = notification.kind.uppercase(),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = BrandNavy
                    )
                }

                Text(
                    text = notification.createdAt.replace("T", " ").take(16),
                    fontSize = 12.sp,
                    color = InkMuted
                )
            }

            Text(
                text = notification.text,
                fontSize = 15.sp,
                color = InkPrimary,
                fontWeight = if (isUnread) FontWeight.SemiBold else FontWeight.Normal
            )

            if (!notification.orderId.isNullOrBlank()) {
                Text(
                    text = stringResource(R.string.notifications_open_order),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = BrandNavy,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
