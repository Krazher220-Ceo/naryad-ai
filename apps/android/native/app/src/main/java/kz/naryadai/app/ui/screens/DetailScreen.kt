// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.data.ActionResult
import kz.naryadai.app.data.ApiException
import kz.naryadai.app.data.DetailData
import kz.naryadai.app.data.OrderEvent
import kz.naryadai.app.data.PhotoView
import kz.naryadai.app.ui.components.AppSnackbarHost
import kz.naryadai.app.ui.components.BottomActionBar
import kz.naryadai.app.ui.components.BrandHeader
import kz.naryadai.app.ui.components.ConnectionPill
import kz.naryadai.app.ui.components.ErrorState
import kz.naryadai.app.ui.components.HelpSheet
import kz.naryadai.app.ui.components.InfoCard
import kz.naryadai.app.ui.components.LabeledValue
import kz.naryadai.app.ui.components.LoadingBox
import kz.naryadai.app.ui.components.OPEN_STATUSES
import kz.naryadai.app.ui.components.OverdueTag
import kz.naryadai.app.ui.components.PAUSE_REASONS
import kz.naryadai.app.ui.components.PriorityBadge
import kz.naryadai.app.ui.components.PrimaryButton
import kz.naryadai.app.ui.components.REJECT_REASONS
import kz.naryadai.app.ui.components.ReasonSheet
import kz.naryadai.app.ui.components.SafetySheet
import kz.naryadai.app.ui.components.SecondaryButton
import kz.naryadai.app.ui.components.SectionTitle
import kz.naryadai.app.ui.components.StatusBadge
import kz.naryadai.app.ui.components.reasonLabel
import kz.naryadai.app.ui.components.showResult
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.DangerSoft
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InfoSoft
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.Oswald
import kz.naryadai.app.ui.theme.Info
import kz.naryadai.app.ui.theme.WarningSoft
import kz.naryadai.app.util.formatDateTime
import kz.naryadai.app.util.minutesLate

class DetailViewModel(handle: SavedStateHandle) : ViewModel() {
    private val repo = Graph.repo
    val orderId: String = checkNotNull(handle["orderId"])
    val online = repo.online
    val pending = repo.pending

    var data by mutableStateOf<DetailData?>(null)
        private set
    var errorText by mutableStateOf<String?>(null)
        private set
    var loading by mutableStateOf(true)
        private set
    var busy by mutableStateOf<String?>(null)
        private set

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            val result = repo.loadDetail(orderId)
            result.onSuccess {
                data = it
                errorText = null
            }.onFailure {
                errorText = (it as? ApiException)?.message ?: ""
            }
            loading = false
        }
    }

    // Одно действие = один запрос на сервер; что можно, а что нельзя, решает сервер
    suspend fun act(action: String, reason: String? = null, reasonCode: String? = null): ActionResult {
        val order = data?.order ?: return ActionResult.Failed("")
        busy = action
        val result = repo.transition(order, action, reason, reasonCode)
        busy = null
        if (result !is ActionResult.Failed) load()
        return result
    }
}

// Какие кнопки показать в каком статусе. Это только подсказка для интерфейса:
// каждое действие всё равно проверяет сервер и вернёт текст ошибки, если оно недопустимо.
private fun primaryAction(status: String): String? = when (status) {
    "issued", "queued" -> "accept"
    "accepted", "rework" -> "start"
    "paused" -> "resume"
    "in_progress" -> "complete"
    else -> null
}

private fun secondaryActions(status: String): List<String> = when (status) {
    "issued" -> listOf("queue", "reject")
    "queued" -> listOf("reject")
    "in_progress" -> listOf("pause")
    else -> emptyList()
}

private fun canAskHelp(status: String) = status in setOf("accepted", "queued", "in_progress", "paused", "rework")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DetailScreen(onBack: () -> Unit, onComplete: (String) -> Unit, vm: DetailViewModel = viewModel()) {
    val online by vm.online.collectAsState()
    val pending by vm.pending.collectAsState()
    val data = vm.data
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var sheet by rememberSaveable { mutableStateOf("") } // reject, pause, safety, help
    var fullscreen by remember { mutableStateOf<String?>(null) }

    val savedText = stringResource(R.string.toast_saved)
    val offlineText = stringResource(R.string.toast_offline)
    val helpSent = stringResource(R.string.help_sent)

    fun run(action: String, reason: String? = null, reasonCode: String? = null, successText: String = savedText) {
        scope.launch {
            val result = vm.act(action, reason, reasonCode)
            if (result !is ActionResult.Failed) sheet = ""
            snackbar.showResult(result, successText, offlineText)
        }
    }

    // Когда в очереди висит действие по этому наряду, а сети нет, говорим об этом
    val queuedHere = pending.count { it.orderId == vm.orderId }

    Scaffold(
        containerColor = Canvas,
        contentWindowInsets = WindowInsets(0),
        topBar = {
            BrandHeader(
                title = stringResource(R.string.order_title, data?.order?.number?.toString() ?: ""),
                onBack = onBack,
                trailing = { ConnectionPill(online, pending.size) },
            )
        },
        snackbarHost = { AppSnackbarHost(snackbar) },
        bottomBar = {
            val order = data?.order
            val primary = order?.let { primaryAction(it.status) }
            val secondary = order?.let { secondaryActions(it.status) }.orEmpty()
            if (order != null && (primary != null || secondary.isNotEmpty())) {
                BottomActionBar {
                    when (primary) {
                        "accept" -> PrimaryButton(stringResource(R.string.action_accept), { run("accept") }, loading = vm.busy == "accept")
                        "start" -> PrimaryButton(stringResource(R.string.action_start), { sheet = "safety" }, loading = vm.busy == "start")
                        "resume" -> PrimaryButton(stringResource(R.string.action_resume), { run("resume") }, loading = vm.busy == "resume")
                        "complete" -> PrimaryButton(stringResource(R.string.action_complete), { onComplete(order.id) })
                    }
                    if (secondary.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            secondary.forEach { action ->
                                when (action) {
                                    "queue" -> SecondaryButton(stringResource(R.string.action_queue), { run("queue") }, Modifier.weight(1f))
                                    "reject" -> SecondaryButton(stringResource(R.string.action_reject), { sheet = "reject" }, Modifier.weight(1f), danger = true)
                                    "pause" -> SecondaryButton(stringResource(R.string.action_pause), { sheet = "pause" }, Modifier.weight(1f), danger = true)
                                }
                            }
                        }
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when {
                data == null && vm.loading -> LoadingBox()
                data == null -> ErrorState(
                    text = vm.errorText?.takeIf { it.isNotBlank() } ?: stringResource(R.string.error_offline_text),
                    onRetry = vm::load,
                    modifier = Modifier.align(Alignment.Center),
                )
                else -> DetailBody(data, queuedHere, onPhoto = { fullscreen = it }, onHelp = { sheet = "help" })
            }
        }
    }

    val order = data?.order
    when (sheet) {
        "reject" -> if (order != null) ReasonSheet(
            title = stringResource(R.string.reject_title, order.number),
            description = stringResource(R.string.reject_desc),
            codes = REJECT_REASONS,
            confirmLabel = stringResource(R.string.action_reject),
            onConfirm = { code, text -> run("reject", text, code) },
            onDismiss = { sheet = "" },
            loading = vm.busy == "reject",
        )
        "pause" -> if (order != null) ReasonSheet(
            title = stringResource(R.string.pause_title, order.number),
            description = stringResource(R.string.pause_desc),
            codes = PAUSE_REASONS,
            confirmLabel = stringResource(R.string.action_pause),
            onConfirm = { code, text -> run("pause", text, code) },
            onDismiss = { sheet = "" },
            loading = vm.busy == "pause",
        )
        "safety" -> if (order != null) SafetySheet(
            needsPermit = order.needsPermit,
            onConfirm = { run("start") },
            onDismiss = { sheet = "" },
            loading = vm.busy == "start",
        )
        "help" -> HelpSheet(
            onConfirm = { comment -> run("help", comment.ifBlank { null }, successText = helpSent) },
            onDismiss = { sheet = "" },
            loading = vm.busy == "help",
        )
    }

    fullscreen?.let { url ->
        Dialog(onDismissRequest = { fullscreen = null }) {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { fullscreen = null },
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DetailBody(data: DetailData, queuedHere: Int, onPhoto: (String) -> Unit, onHelp: () -> Unit) {
    val order = data.order
    val late = if (order.status in OPEN_STATUSES) minutesLate(order.dueAt) else null
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp).padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PriorityBadge(order.priority)
            StatusBadge(order.status)
            if (late != null) OverdueTag(late)
        }
        Text(order.description, style = MaterialTheme.typography.titleMedium.copy(fontSize = 22.sp, lineHeight = 29.sp), color = Ink)

        if (queuedHere > 0) Notice(stringResource(R.string.notice_queued_offline), WarningSoft, Ink)
        if (data.fromCache) Notice(stringResource(R.string.error_offline_text), WarningSoft, Ink)
        statusNotice(order.status)?.let { Notice(stringResource(it), InfoSoft, Ink) }

        InfoCard {
            val place = listOfNotNull(order.equipment?.name, order.equipment?.inventoryNo).filter { it.isNotBlank() }.joinToString(" · ")
            if (place.isNotBlank()) LabeledValue(stringResource(R.string.detail_equipment), place)
            order.section?.name?.takeIf { it.isNotBlank() }?.let { LabeledValue(stringResource(R.string.detail_section), it) }
            LabeledValue(stringResource(R.string.detail_due), formatDateTime(order.dueAt))
            order.assignee?.fullName?.takeIf { it.isNotBlank() }?.let { LabeledValue(stringResource(R.string.detail_assignee), it) }
            order.master?.fullName?.takeIf { it.isNotBlank() }?.let { LabeledValue(stringResource(R.string.detail_master), it) }
            order.fault?.takeIf { it.code.isNotBlank() }?.let { LabeledValue(stringResource(R.string.detail_fault), "${it.code} · ${it.name}") }
            if (order.needsPermit) LabeledValue(stringResource(R.string.detail_permit), "✓")
        }

        order.workDone?.takeIf { it.isNotBlank() }?.let {
            InfoCard {
                SectionTitle(stringResource(R.string.detail_work_done))
                Text(it, style = MaterialTheme.typography.bodyLarge, color = Ink)
            }
        }

        PhotoSection(stringResource(R.string.detail_photos_before), data.photos.filter { it.photo.kind == "before" }, onPhoto)
        PhotoSection(stringResource(R.string.detail_photos_after), data.photos.filter { it.photo.kind == "after" }, onPhoto)

        if (data.materials.isNotEmpty()) {
            InfoCard {
                SectionTitle(stringResource(R.string.detail_materials))
                data.materials.forEach { m ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(m.material?.name ?: "—", style = MaterialTheme.typography.bodyLarge, color = Ink, modifier = Modifier.weight(1f))
                        Text("${trimQty(m.qty)} ${m.material?.unit.orEmpty()}", style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold), color = Ink)
                    }
                }
            }
        }

        if (canAskHelp(order.status)) {
            SecondaryButton(stringResource(R.string.action_help), onHelp, Modifier.fillMaxWidth(), leading = Icons.Filled.SupportAgent)
        }

        if (data.events.isNotEmpty()) {
            SectionTitle(stringResource(R.string.detail_history))
            InfoCard { data.events.forEachIndexed { i, e -> EventRow(e, showDivider = i > 0) } }
        }
    }
}

private fun statusNotice(status: String): Int? = when (status) {
    "done" -> R.string.notice_done
    "ai_review" -> R.string.notice_ai_review
    "closed" -> R.string.notice_closed
    "rejected" -> R.string.notice_rejected
    "cancelled" -> R.string.notice_cancelled
    else -> null
}

@Composable
private fun Notice(text: String, bg: androidx.compose.ui.graphics.Color, fg: androidx.compose.ui.graphics.Color) {
    Text(
        text,
        modifier = Modifier.fillMaxWidth().background(bg, RoundedCornerShape(12.dp)).padding(14.dp),
        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
        color = fg,
    )
}

@Composable
private fun PhotoSection(title: String, photos: List<PhotoView>, onPhoto: (String) -> Unit) {
    if (photos.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionTitle(title)
        photos.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { p ->
                    Box(
                        Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(12.dp)).background(Line)
                            .clickable(enabled = p.url != null) { p.url?.let(onPhoto) },
                    ) {
                        if (p.url != null) AsyncImage(p.url, contentDescription = title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    }
                }
                repeat(3 - row.size) { Box(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun EventRow(e: OrderEvent, showDivider: Boolean) {
    if (showDivider) HorizontalDivider(color = Line)
    Column(Modifier.padding(top = if (showDivider) 4.dp else 0.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(eventLabel(e.action), style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold), color = Ink, modifier = Modifier.weight(1f))
            Text(formatDateTime(e.createdAt), style = MaterialTheme.typography.bodySmall, color = InkMuted)
        }
        e.actor?.fullName?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = InkMuted) }
        val label = e.reasonCode?.takeIf { it.isNotBlank() }?.let { reasonLabel(it) }
        val reason = listOfNotNull(label, e.reason?.takeIf { it.isNotBlank() }).joinToString(": ")
        if (reason.isNotBlank()) {
            Text(
                "${stringResource(R.string.reason_label)}: $reason",
                modifier = Modifier.background(DangerSoft, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
                color = Danger,
            )
        }
        e.comment?.takeIf { it.isNotBlank() }?.let {
            Text("«$it»", style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic), color = InkMuted)
        }
    }
}

@Composable
private fun eventLabel(action: String): String {
    val res = when (action) {
        "issue" -> R.string.event_issue
        "accept" -> R.string.event_accept
        "queue" -> R.string.event_queue
        "reject" -> R.string.event_reject
        "start" -> R.string.event_start
        "pause" -> R.string.event_pause
        "resume" -> R.string.event_resume
        "done" -> R.string.event_done
        "send_to_review" -> R.string.event_send_to_review
        "close" -> R.string.event_close
        "rework" -> R.string.event_rework
        "cancel" -> R.string.event_cancel
        "reassign" -> R.string.event_reassign
        "change_priority" -> R.string.event_change_priority
        "help" -> R.string.event_help
        "ai_verdict" -> R.string.event_ai_verdict
        "master_score" -> R.string.event_master_score
        else -> null
    }
    return if (res != null) stringResource(res) else action
}

fun trimQty(q: Double): String = if (q % 1.0 == 0.0) q.toLong().toString() else q.toString()
