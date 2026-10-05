package kz.naryadai.app.ui.screens.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import kz.naryadai.app.NaryadApplication
import kz.naryadai.app.R
import kz.naryadai.app.data.model.PhotoItem
import kz.naryadai.app.data.model.WorkOrderEvent
import kz.naryadai.app.ui.components.OfflineBanner
import kz.naryadai.app.ui.components.OverdueTag
import kz.naryadai.app.ui.components.PriorityBadge
import kz.naryadai.app.ui.components.ReasonBottomSheet
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

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun OrderDetailScreen(
    orderId: String,
    onBackClick: () -> Unit,
    onNavigateToComplete: (orderId: String) -> Unit
) {
    val context = LocalContext.current
    val app = NaryadApplication.get(context)
    val repo = app.orderRepository
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val order by repo.getOrderFlow(orderId).collectAsState(initial = null)
    val events by repo.getEventsFlow(orderId).collectAsState(initial = emptyList())
    val photos by repo.getPhotosFlow(orderId).collectAsState(initial = emptyList())
    val offlineCount by repo.offlineQueueCount.collectAsState(initial = 0)

    var isActionLoading by remember { mutableStateOf(false) }
    var activeReasonDialogAction by remember { mutableStateOf<String?>(null) } // "pause" or "reject"
    val isOnline = NetworkUtils.isOnline(context)

    LaunchedEffect(orderId) {
        repo.refreshOrderDetails(orderId)
    }

    fun executeTransition(action: String, reason: String? = null, reasonCode: String? = null) {
        isActionLoading = true
        scope.launch {
            val result = repo.performTransition(
                orderId = orderId,
                action = action,
                reason = reason,
                reasonCode = reasonCode
            )
            isActionLoading = false
            if (result.isSuccess) {
                val status = result.getOrNull()
                if (status == "queued_offline") {
                    snackbarHostState.showSnackbar(context.getString(R.string.offline_queued_info))
                }
            } else {
                val err = result.exceptionOrNull()?.message ?: context.getString(R.string.error_title)
                snackbarHostState.showSnackbar(context.getString(R.string.error_action_failed, err))
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = order?.let { stringResource(R.string.order_number_prefix, it.number) } ?: "",
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BrandNavy)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = CanvasBg
    ) { innerPadding ->
        if (order == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = BrandNavy)
            }
        } else {
            val curOrder = order!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                OfflineBanner(
                    isOffline = !isOnline,
                    pendingCount = offlineCount
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Статус, приоритет, просрочка
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        PriorityBadge(priority = curOrder.priority)
                        StatusBadge(status = curOrder.status)
                        if (curOrder.overdue) {
                            OverdueTag()
                        }
                    }

                    // Описание
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = curOrder.description,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = InkPrimary
                            )

                            val eqSection = buildString {
                                curOrder.equipmentName?.let { append(it) }
                                if (!curOrder.equipmentName.isNullOrBlank() && !curOrder.sectionName.isNullOrBlank()) {
                                    append(" · ")
                                }
                                curOrder.sectionName?.let { append(it) }
                            }
                            if (eqSection.isNotBlank()) {
                                Text(
                                    text = eqSection,
                                    fontSize = 15.sp,
                                    color = InkMuted
                                )
                            }

                            if (!curOrder.assigneeName.isNullOrBlank()) {
                                Text(
                                    text = stringResource(R.string.order_assignee_prefix, curOrder.assigneeName),
                                    fontSize = 14.sp,
                                    color = InkMuted
                                )
                            }

                            if (curOrder.dueAt.isNotBlank()) {
                                Text(
                                    text = stringResource(R.string.order_due_prefix, curOrder.dueAt.replace("T", " ").take(16)),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (curOrder.overdue) DangerRed else InkPrimary
                                )
                            }
                        }
                    }

                    // Фотографии «до» и «после»
                    PhotoSection(photos = photos)

                    // История событий
                    HistorySection(events = events)

                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Нижняя панель действий (главная кнопка не ниже 56 dp)
                ActionBottomBar(
                    status = curOrder.status,
                    isLoading = isActionLoading,
                    onPrimaryAction = { action ->
                        if (action == "complete") {
                            onNavigateToComplete(orderId)
                        } else {
                            executeTransition(action)
                        }
                    },
                    onOpenReasonDialog = { action ->
                        activeReasonDialogAction = action
                    }
                )
            }
        }
    }

    // Диалог причины для паузы или отклонения
    activeReasonDialogAction?.let { action ->
        val isReject = action == "reject"
        ReasonBottomSheet(
            title = stringResource(R.string.reason_sheet_title),
            actionButtonText = stringResource(if (isReject) R.string.action_reject else R.string.action_pause),
            isDanger = isReject,
            onDismiss = { activeReasonDialogAction = null },
            onConfirm = { code, text ->
                activeReasonDialogAction = null
                executeTransition(
                    action = action,
                    reason = text.ifBlank { null },
                    reasonCode = code
                )
            }
        )
    }
}

@Composable
fun PhotoSection(photos: List<PhotoItem>) {
    val beforePhotos = photos.filter { it.kind == "before" }
    val afterPhotos = photos.filter { it.kind == "after" }

    if (photos.isNotEmpty()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (beforePhotos.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.order_photos_before),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )
                    PhotoRow(photos = beforePhotos)
                }

                if (afterPhotos.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.order_photos_after),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )
                    PhotoRow(photos = afterPhotos)
                }
            }
        }
    }
}

@Composable
fun PhotoRow(photos: List<PhotoItem>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        photos.forEach { photo ->
            photo.url?.let { url ->
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(88.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .border(1.dp, LineBorder, RoundedCornerShape(10.dp))
                )
            }
        }
    }
}

@Composable
fun HistorySection(events: List<WorkOrderEvent>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.order_history_title),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = InkPrimary
            )

            if (events.isEmpty()) {
                Text(
                    text = stringResource(R.string.order_no_history),
                    fontSize = 14.sp,
                    color = InkMuted
                )
            } else {
                events.forEach { ev ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = ev.action,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = InkPrimary
                            )
                            Text(
                                text = ev.createdAt.replace("T", " ").take(16),
                                fontSize = 12.sp,
                                color = InkMuted
                            )
                        }

                        if (!ev.reason.isNullOrBlank()) {
                            Text(
                                text = ev.reason,
                                fontSize = 14.sp,
                                color = InkMuted
                            )
                        }

                        if (!ev.actorName.isNullOrBlank()) {
                            Text(
                                text = ev.actorName,
                                fontSize = 12.sp,
                                color = InkMuted
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ActionBottomBar(
    status: String,
    isLoading: Boolean,
    onPrimaryAction: (action: String) -> Unit,
    onOpenReasonDialog: (action: String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Вторичные кнопки (Пауза, В очередь, Отклонить, Нужна помощь)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                when (status) {
                    "issued" -> {
                        OutlinedButton(
                            onClick = { onOpenReasonDialog("reject") },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("reject_button")
                        ) {
                            Text(stringResource(R.string.action_reject), color = DangerRed)
                        }
                        OutlinedButton(
                            onClick = { onPrimaryAction("queue") },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("queue_button")
                        ) {
                            Text(stringResource(R.string.action_queue))
                        }
                    }
                    "in_progress" -> {
                        OutlinedButton(
                            onClick = { onOpenReasonDialog("pause") },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("pause_button")
                        ) {
                            Text(stringResource(R.string.action_pause))
                        }
                        OutlinedButton(
                            onClick = { onPrimaryAction("help") },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("help_button")
                        ) {
                            Text(stringResource(R.string.action_help))
                        }
                    }
                    "accepted", "queued" -> {
                        OutlinedButton(
                            onClick = { onOpenReasonDialog("pause") },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Text(stringResource(R.string.action_pause))
                        }
                    }
                }
            }

            // Главная большая кнопка (высота не ниже 56 dp)
            when (status) {
                "issued" -> {
                    BigActionButton(
                        text = stringResource(R.string.action_accept),
                        isLoading = isLoading,
                        tag = "accept_button",
                        onClick = { onPrimaryAction("accept") }
                    )
                }
                "accepted", "queued", "rework" -> {
                    BigActionButton(
                        text = stringResource(R.string.action_start),
                        isLoading = isLoading,
                        tag = "start_button",
                        onClick = { onPrimaryAction("start") }
                    )
                }
                "in_progress" -> {
                    BigActionButton(
                        text = stringResource(R.string.action_complete),
                        isLoading = isLoading,
                        tag = "complete_button",
                        onClick = { onPrimaryAction("complete") }
                    )
                }
                "paused" -> {
                    BigActionButton(
                        text = stringResource(R.string.action_resume),
                        isLoading = isLoading,
                        tag = "resume_button",
                        onClick = { onPrimaryAction("resume") }
                    )
                }
            }
        }
    }
}

@Composable
fun BigActionButton(
    text: String,
    isLoading: Boolean,
    tag: String,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = !isLoading,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .testTag(tag)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = Color.White,
                modifier = Modifier.size(24.dp),
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}
