// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.data.ActionResult
import kz.naryadai.app.data.FaultCode
import kz.naryadai.app.data.Material
import kz.naryadai.app.data.SelectedMaterial
import kz.naryadai.app.data.WorkOrder
import kz.naryadai.app.ui.components.AppSnackbarHost
import kz.naryadai.app.ui.components.BottomActionBar
import kz.naryadai.app.ui.components.BrandHeader
import kz.naryadai.app.ui.components.ConnectionPill
import kz.naryadai.app.ui.components.InfoCard
import kz.naryadai.app.ui.components.PrimaryButton
import kz.naryadai.app.ui.components.SecondaryButton
import kz.naryadai.app.ui.components.SectionTitle
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InfoSoft
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.LineStrong
import kz.naryadai.app.ui.theme.Surface
import kz.naryadai.app.ui.theme.WarningSoft
import java.io.File
import java.util.UUID

private const val STEPS = 4
private const val MAX_PHOTOS = 5

class CompleteViewModel(handle: SavedStateHandle) : ViewModel() {
    private val repo = Graph.repo
    val orderId: String = checkNotNull(handle["orderId"])
    val online = repo.online
    val pending = repo.pending

    var order by mutableStateOf<WorkOrder?>(null)
        private set
    var step by mutableIntStateOf(0)
    var workDone by mutableStateOf("")
    var faultCode by mutableStateOf<String?>(null)
    val materials: SnapshotStateList<SelectedMaterial> = mutableStateListOf()
    val photos: SnapshotStateList<Uri> = mutableStateListOf()
    var faultCodes by mutableStateOf<List<FaultCode>>(emptyList())
        private set
    var allMaterials by mutableStateOf<List<Material>>(emptyList())
        private set
    var submitting by mutableStateOf(false)
        private set

    init {
        viewModelScope.launch { repo.loadDetail(orderId).onSuccess { order = it.order } }
        viewModelScope.launch { faultCodes = repo.faultCodes() }
        viewModelScope.launch { allMaterials = repo.materials() }
    }

    // Выбрали шифр: если материалов ещё нет, подставляем типовые. Только подсказка, список можно менять.
    fun pickFault(code: String?) {
        faultCode = code
        if (code != null && materials.isEmpty()) {
            allMaterials.filter { code in it.faultCodes }.forEach {
                materials.add(SelectedMaterial(it.id, it.name, it.unit, it.typicalQty))
            }
        }
    }

    suspend fun submit(): ActionResult {
        val o = order ?: return ActionResult.Failed("")
        submitting = true
        val result = repo.complete(o, workDone, faultCode, materials.toList(), photos.toList())
        submitting = false
        return result
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompleteScreen(onBack: () -> Unit, onDone: (ActionResult) -> Unit, vm: CompleteViewModel = viewModel()) {
    val online by vm.online.collectAsState()
    val pending by vm.pending.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val order = vm.order
    var picker by rememberSaveable { mutableStateOf("") } // fault, material
    var cameraUri by rememberSaveable { mutableStateOf<Uri?>(null) }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = cameraUri
        if (ok && uri != null && vm.photos.size < MAX_PHOTOS) vm.photos.add(uri)
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_PHOTOS)) { uris ->
        uris.forEach { if (vm.photos.size < MAX_PHOTOS) vm.photos.add(it) }
    }

    fun back() {
        if (vm.step > 0) vm.step-- else onBack()
    }

    val stepTitles = listOf(R.string.step_works, R.string.step_code, R.string.step_materials, R.string.step_photo)
    val canNext = vm.step != 0 || vm.workDone.isNotBlank()
    val last = vm.step == STEPS - 1

    Scaffold(
        modifier = Modifier.imePadding(),
        containerColor = Canvas,
        contentWindowInsets = WindowInsets(0),
        topBar = {
            BrandHeader(
                title = stringResource(R.string.complete_title, order?.number?.toString() ?: ""),
                onBack = ::back,
                trailing = { ConnectionPill(online, pending.size) },
            )
        },
        snackbarHost = { AppSnackbarHost(snackbar) },
        bottomBar = {
            BottomActionBar {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (vm.step > 0) SecondaryButton(stringResource(R.string.back), ::back, Modifier.weight(0.38f))
                    PrimaryButton(
                        stringResource(if (last) R.string.submit_review else R.string.next),
                        onClick = {
                            if (!last) {
                                vm.step++
                            } else {
                                scope.launch {
                                    val result = vm.submit()
                                    if (result is ActionResult.Failed) {
                                        snackbar.showSnackbar(result.message)
                                    } else {
                                        onDone(result)
                                    }
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = canNext && order != null,
                        loading = vm.submitting,
                    )
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            // Индикатор шага
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    repeat(STEPS) { i ->
                        Box(Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(if (i <= vm.step) Brand else Line))
                    }
                }
                Text(
                    stringResource(R.string.step_of, vm.step + 1, STEPS) + " · " + stringResource(stepTitles[vm.step]),
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = InkMuted,
                )
            }
            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                when (vm.step) {
                    0 -> {
                        SectionTitle(stringResource(R.string.detail_work_done))
                        OutlinedTextField(
                            value = vm.workDone,
                            onValueChange = { vm.workDone = it },
                            modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp),
                            placeholder = { Text(stringResource(R.string.work_done_placeholder)) },
                            shape = RoundedCornerShape(12.dp),
                            textStyle = MaterialTheme.typography.bodyLarge,
                        )
                        if (vm.workDone.isBlank()) Text(stringResource(R.string.work_done_required), style = MaterialTheme.typography.bodySmall, color = InkMuted)
                    }
                    1 -> {
                        SectionTitle(stringResource(R.string.detail_fault))
                        val selected = vm.faultCodes.firstOrNull { it.code == vm.faultCode }
                        PickerField(
                            text = selected?.let { "${it.code} · ${it.name}" } ?: stringResource(R.string.fault_placeholder),
                            filled = selected != null,
                            onClick = { picker = "fault" },
                        )
                    }
                    2 -> {
                        SectionTitle(stringResource(R.string.step_materials))
                        if (vm.materials.isEmpty()) {
                            Text(stringResource(R.string.materials_empty), style = MaterialTheme.typography.bodyMedium, color = InkMuted)
                        }
                        vm.materials.forEachIndexed { index, m ->
                            MaterialRow(
                                m,
                                onMinus = { if (m.qty > 1) vm.materials[index] = m.copy(qty = m.qty - 1) },
                                onPlus = { vm.materials[index] = m.copy(qty = m.qty + 1) },
                                onRemove = { vm.materials.removeAt(index) },
                            )
                        }
                        SecondaryButton(stringResource(R.string.material_add), { picker = "material" }, Modifier.fillMaxWidth(), leading = Icons.Filled.Add)
                    }
                    else -> {
                        SectionTitle(stringResource(R.string.detail_photos_after))
                        val unplanned = order?.type == "unplanned"
                        Text(
                            stringResource(if (unplanned) R.string.photo_required else R.string.photo_optional),
                            modifier = Modifier.fillMaxWidth().background(if (unplanned) WarningSoft else InfoSoft, RoundedCornerShape(12.dp)).padding(14.dp),
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = Ink,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SecondaryButton(
                                stringResource(R.string.photo_camera),
                                {
                                    if (vm.photos.size >= MAX_PHOTOS) return@SecondaryButton
                                    val file = File(context.cacheDir, "camera/${UUID.randomUUID()}.jpg").also { it.parentFile?.mkdirs() }
                                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                                    cameraUri = uri
                                    camera.launch(uri)
                                },
                                Modifier.weight(1f),
                                leading = Icons.Filled.PhotoCamera,
                            )
                            SecondaryButton(
                                stringResource(R.string.photo_gallery),
                                { gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                                Modifier.weight(1f),
                                leading = Icons.Filled.PhotoLibrary,
                            )
                        }
                        Text(
                            stringResource(R.string.photo_count, vm.photos.size, MAX_PHOTOS),
                            style = MaterialTheme.typography.bodyMedium,
                            color = InkMuted,
                        )
                        vm.photos.chunked(3).forEachIndexed { rowIndex, row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEachIndexed { i, uri ->
                                    Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(12.dp)).background(Line)) {
                                        AsyncImage(uri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                                        IconButton(
                                            onClick = { vm.photos.remove(uri) },
                                            modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).size(40.dp).background(Ink.copy(alpha = 0.75f), CircleShape),
                                        ) {
                                            Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.photo_remove), tint = androidx.compose.ui.graphics.Color.White)
                                        }
                                    }
                                }
                                repeat(3 - row.size) { Box(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
        }
    }

    when (picker) {
        "fault" -> PickerSheet(
            items = vm.faultCodes.map { it.code to "${it.code} · ${it.name}" },
            noneLabel = stringResource(R.string.fault_none),
            onPick = { vm.pickFault(it); picker = "" },
            onDismiss = { picker = "" },
        )
        "material" -> PickerSheet(
            items = vm.allMaterials.map { it.id to "${it.name}, ${it.unit}" },
            noneLabel = null,
            onPick = { id ->
                val m = vm.allMaterials.firstOrNull { it.id == id }
                if (m != null && vm.materials.none { it.materialId == id }) vm.materials.add(SelectedMaterial(m.id, m.name, m.unit, m.typicalQty))
                picker = ""
            },
            onDismiss = { picker = "" },
        )
    }
}

@Composable
private fun PickerField(text: String, filled: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).background(Surface, RoundedCornerShape(12.dp))
            .border(1.5.dp, if (filled) Brand else LineStrong, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = if (filled) FontWeight.SemiBold else FontWeight.Normal), color = if (filled) Ink else InkMuted)
    }
}

@Composable
private fun MaterialRow(m: SelectedMaterial, onMinus: () -> Unit, onPlus: () -> Unit, onRemove: () -> Unit) {
    InfoCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(m.name, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold), color = Ink)
                Text(m.unit, style = MaterialTheme.typography.bodySmall, color = InkMuted)
            }
            IconButton(onClick = onRemove, modifier = Modifier.size(48.dp)) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.remove), tint = Danger)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StepperButton(Icons.Filled.Remove, stringResource(R.string.qty_minus), onMinus)
            Text(
                trimQty(m.qty),
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.headlineMedium,
                color = Ink,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            StepperButton(Icons.Filled.Add, stringResource(R.string.qty_plus), onPlus)
        }
    }
}

@Composable
private fun StepperButton(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, onClick: () -> Unit) {
    Box(
        Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(Brand).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(28.dp))
    }
}

// Лист выбора из длинного списка с поиском
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PickerSheet(items: List<Pair<String, String>>, noneLabel: String?, onPick: (String?) -> Unit, onDismiss: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val shown = items.filter { it.second.contains(query, ignoreCase = true) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Surface,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
    ) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.search)) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
            )
            LazyColumn(Modifier.heightIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (noneLabel != null) {
                    item { PickerRow(noneLabel) { onPick(null) } }
                }
                items(shown, key = { it.first }) { (key, label) -> PickerRow(label) { onPick(key) } }
            }
        }
    }
}

@Composable
private fun PickerRow(label: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(onClick = onClick).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyLarge, color = Ink)
    }
}
