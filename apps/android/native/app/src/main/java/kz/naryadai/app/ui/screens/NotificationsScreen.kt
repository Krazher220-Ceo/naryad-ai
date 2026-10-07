// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.screens

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.data.AppNotification
import kz.naryadai.app.ui.components.BrandHeader
import kz.naryadai.app.ui.components.ConnectionPill
import kz.naryadai.app.ui.components.EmptyState
import kz.naryadai.app.ui.theme.Accent
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.Surface
import kz.naryadai.app.util.formatDateTime

private fun kindRes(kind: String): Int? = when (kind) {
    "new_order" -> R.string.notif_kind_new_order
    "remind" -> R.string.notif_kind_remind
    "overdue" -> R.string.notif_kind_overdue
    "not_accepted" -> R.string.notif_kind_not_accepted
    "lead_overdue" -> R.string.notif_kind_lead_overdue
    "review_ready" -> R.string.notif_kind_review_ready
    "status_change" -> R.string.notif_kind_status_change
    "new_request" -> R.string.notif_kind_new_request
    else -> null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(onOpenOrder: (String) -> Unit) {
    val repo = Graph.repo
    val items by repo.notifications.collectAsState()
    val online by repo.online.collectAsState()
    val pending by repo.pending.collectAsState()
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }
    val unread = items.count { it.readAt == null }

    Column(Modifier.fillMaxSize().background(Canvas)) {
        BrandHeader(
            title = stringResource(R.string.notif_title),
            subtitle = if (unread > 0) stringResource(R.string.notif_unread) + ": " + unread else null,
            trailing = { ConnectionPill(online, pending.size) },
        )
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { scope.launch { refreshing = true; repo.refreshNotifications(); refreshing = false } },
            modifier = Modifier.weight(1f),
        ) {
            if (items.isEmpty()) {
                LazyColumn(Modifier.fillMaxSize()) {
                    item {
                        EmptyState(
                            icon = Icons.Filled.Notifications,
                            title = stringResource(R.string.notif_empty_title),
                            text = stringResource(R.string.notif_empty_text),
                        )
                    }
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (unread > 0) {
                        item(key = "read-all") {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                TextButton(onClick = { scope.launch { repo.markNotificationsRead(null) } }, modifier = Modifier.heightIn(min = 48.dp)) {
                                    Text(stringResource(R.string.notif_read_all), style = MaterialTheme.typography.labelLarge, color = Brand)
                                }
                            }
                        }
                    }
                    items(items, key = { it.id }) { n ->
                        NotificationRow(n) {
                            if (n.readAt == null) scope.launch { repo.markNotificationsRead(listOf(n.id)) }
                            n.orderId?.let(onOpenOrder)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(n: AppNotification, onClick: () -> Unit) {
    val unread = n.readAt == null
    Row(
        Modifier.fillMaxWidth().heightIn(min = 72.dp)
            .background(Surface, RoundedCornerShape(16.dp))
            .border(if (unread) 2.dp else 1.dp, if (unread) Brand else Line, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick).padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.padding(top = 6.dp).size(12.dp).background(if (unread) Accent else Color.Transparent, CircleShape).border(if (unread) 1.5.dp else 0.dp, Ink, CircleShape))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    kindRes(n.kind)?.let { stringResource(it) } ?: "",
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = Brand,
                    modifier = Modifier.weight(1f),
                )
                Text(formatDateTime(n.createdAt), style = MaterialTheme.typography.bodySmall, color = InkMuted)
            }
            Text(n.text, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Normal), color = Ink, maxLines = 6, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
        }
    }
}
