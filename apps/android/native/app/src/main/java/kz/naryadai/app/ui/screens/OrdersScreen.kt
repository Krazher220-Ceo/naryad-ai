// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.data.WorkOrder
import kz.naryadai.app.ui.components.BrandHeader
import kz.naryadai.app.ui.components.ConnectionPill
import kz.naryadai.app.ui.components.EmptyState
import kz.naryadai.app.ui.components.ErrorState
import kz.naryadai.app.ui.components.LoadingBox
import kz.naryadai.app.ui.components.OrderCard
import kz.naryadai.app.ui.components.SecondaryButton
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.AccentInk
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.Oswald
import kz.naryadai.app.ui.theme.Surface

class OrdersViewModel : ViewModel() {
    private val repo = Graph.repo
    val orders = repo.orders
    val online = repo.online
    val pending = repo.pending

    var refreshing by mutableStateOf(false)
        private set
    var failed by mutableStateOf(false)
        private set
    var loaded by mutableStateOf(false)
        private set

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            refreshing = true
            failed = repo.refreshAll() != null
            loaded = true
            refreshing = false
        }
    }
}

// Только порядок показа: аварийные наверху, потом по сроку (так же, как на сайте)
private val priorityRank = mapOf("emergency" to 0, "high" to 1, "normal" to 2, "planned" to 3)

private fun List<WorkOrder>.displayOrder() =
    sortedWith(compareBy({ priorityRank[it.priority] ?: 4 }, { it.dueAt }))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(onOpen: (String) -> Unit, vm: OrdersViewModel = viewModel()) {
    val orders by vm.orders.collectAsState()
    val online by vm.online.collectAsState()
    val pending by vm.pending.collectAsState()
    val employee by Graph.session.employee.collectAsState()
    var showDone by rememberSaveable { mutableStateOf(false) }

    // Группы как на сайте: новые, сейчас, очередь, сделано
    val issued = orders.filter { it.status == "issued" }.displayOrder()
    val now = orders.filter { it.status in setOf("in_progress", "paused", "accepted", "rework") }.displayOrder()
    val done = orders.filter { it.status in setOf("done", "ai_review", "closed", "cancelled") }.sortedByDescending { it.updatedAt }
    val queue = orders.filter { it !in issued && it !in now && it !in done }.displayOrder()

    Column(Modifier.fillMaxSize().background(Canvas)) {
        BrandHeader(
            title = stringResource(R.string.orders_title),
            subtitle = employee?.fullName,
            trailing = { ConnectionPill(online, pending.size) },
        )
        PullToRefreshBox(isRefreshing = vm.refreshing, onRefresh = vm::refresh, modifier = Modifier.weight(1f)) {
            when {
                orders.isEmpty() && !vm.loaded -> LoadingBox()
                orders.isEmpty() && vm.failed -> ErrorState(
                    text = stringResource(if (online) R.string.error_text else R.string.error_offline_text),
                    onRetry = vm::refresh,
                    modifier = Modifier.align(Alignment.Center),
                )
                orders.isEmpty() -> LazyColumn(Modifier.fillMaxSize()) {
                    item {
                        EmptyState(
                            icon = Icons.Filled.Assignment,
                            title = stringResource(R.string.empty_orders_title),
                            text = stringResource(R.string.empty_orders_text),
                            action = { SecondaryButton(stringResource(R.string.retry), vm::refresh, Modifier.fillMaxWidth(0.7f)) },
                        )
                    }
                }
                else -> LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item(key = "counters") {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Counter(now.size, stringResource(R.string.count_now), Modifier.weight(1f))
                            Counter(queue.size + issued.size, stringResource(R.string.count_queue), Modifier.weight(1f))
                            Counter(done.size, stringResource(R.string.count_done), Modifier.weight(1f))
                        }
                    }
                    if (issued.isNotEmpty()) {
                        item(key = "h-new") { GroupTitle(stringResource(R.string.orders_new)) }
                        items(issued, key = { it.id }) { OrderCard(it, onClick = { onOpen(it.id) }) }
                    }
                    if (now.isNotEmpty()) {
                        item(key = "h-now") { GroupTitle(stringResource(R.string.orders_now)) }
                        items(now, key = { it.id }) { OrderCard(it, onClick = { onOpen(it.id) }) }
                    }
                    if (queue.isNotEmpty()) {
                        item(key = "h-queue") { GroupTitle(stringResource(R.string.orders_queue_count, queue.size)) }
                        items(queue, key = { it.id }) { OrderCard(it, onClick = { onOpen(it.id) }) }
                    }
                    if (done.isNotEmpty()) {
                        item(key = "h-done") {
                            Row(
                                Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable { showDone = !showDone },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    stringResource(R.string.orders_done_count, done.size),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Ink,
                                    modifier = Modifier.weight(1f),
                                    maxLines = 1,
                                )
                                Icon(
                                    if (showDone) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                                    contentDescription = stringResource(if (showDone) R.string.orders_hide_done else R.string.orders_show_done),
                                    tint = Brand,
                                    modifier = Modifier.size(32.dp),
                                )
                            }
                        }
                        if (showDone) items(done, key = { it.id }) { OrderCard(it, onClick = { onOpen(it.id) }) }
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, color = Ink, modifier = Modifier.padding(top = 4.dp))
}

@Composable
private fun Counter(count: Int, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier.background(Surface, RoundedCornerShape(16.dp)).border(1.dp, Line, RoundedCornerShape(16.dp)).padding(horizontal = 10.dp, vertical = 10.dp),
    ) {
        Text(count.toString(), style = MaterialTheme.typography.headlineMedium.copy(fontFamily = Oswald), color = Ink)
        Text(label, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp), color = InkMuted, maxLines = 1, softWrap = false)
    }
}
