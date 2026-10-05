package kz.naryadai.app.ui.screens.complete

import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.launch
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kz.naryadai.app.NaryadApplication
import kz.naryadai.app.R
import kz.naryadai.app.data.model.FaultCodeItem
import kz.naryadai.app.data.model.MaterialItem
import kz.naryadai.app.data.model.SelectedMaterial
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.CanvasBg
import kz.naryadai.app.ui.theme.DangerRed
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InkPrimary
import kz.naryadai.app.ui.theme.LineBorder
import kz.naryadai.app.ui.theme.SurfaceWhite
import kz.naryadai.app.ui.theme.WarningSoft
import java.io.ByteArrayOutputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompleteOrderScreen(
    orderId: String,
    onBackClick: () -> Unit,
    onCompleteSuccess: () -> Unit
) {
    val context = LocalContext.current
    val app = NaryadApplication.get(context)
    val repo = app.orderRepository
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val order by repo.getOrderFlow(orderId).collectAsState(initial = null)

    var workDone by remember { mutableStateOf("") }
    var selectedFaultCode by remember { mutableStateOf<FaultCodeItem?>(null) }
    var faultCodes by remember { mutableStateOf<List<FaultCodeItem>>(emptyList()) }
    var allMaterials by remember { mutableStateOf<List<MaterialItem>>(emptyList()) }
    val selectedMaterials = remember { mutableStateListOf<SelectedMaterial>() }

    var photoBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var photoBytes by remember { mutableStateOf<ByteArray?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    var faultDropdownExpanded by remember { mutableStateOf(false) }
    var materialDropdownExpanded by remember { mutableStateOf(false) }

    // Камера для фото «после»
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            photoBitmap = bitmap
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)
            photoBytes = stream.toByteArray()
        }
    }

    LaunchedEffect(Unit) {
        val codes = repo.fetchFaultCodes().getOrNull() ?: emptyList()
        faultCodes = codes

        val mats = repo.fetchMaterials().getOrNull() ?: emptyList()
        allMaterials = mats
    }

    fun submit() {
        if (workDone.isBlank()) {
            scope.launch {
                snackbarHostState.showSnackbar(context.getString(R.string.complete_work_done_label))
            }
            return
        }

        isSubmitting = true
        scope.launch {
            // Если сделано фото «после», сначала загружаем его
            photoBytes?.let { bytes ->
                repo.uploadAndRegisterPhoto(orderId, "after", bytes)
            }

            val materialsPayload = selectedMaterials.map { it.materialId to it.qty }
            val result = repo.completeOrder(
                orderId = orderId,
                workDone = workDone.trim(),
                faultCode = selectedFaultCode?.code,
                materials = materialsPayload
            )

            isSubmitting = false
            if (result.isSuccess) {
                onCompleteSuccess()
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
                        text = order?.let { stringResource(R.string.complete_screen_title, it.number) }
                            ?: stringResource(R.string.action_complete),
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // «Что сделано»
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
                        text = stringResource(R.string.complete_work_done_label),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )

                    OutlinedTextField(
                        value = workDone,
                        onValueChange = { workDone = it },
                        placeholder = { Text(stringResource(R.string.complete_work_done_placeholder)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("work_done_input"),
                        minLines = 3,
                        maxLines = 6,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandNavy,
                            unfocusedBorderColor = LineBorder
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            }

            // Шифр неисправности
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
                        text = stringResource(R.string.complete_fault_code_label),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )

                    ExposedDropdownMenuBox(
                        expanded = faultDropdownExpanded,
                        onExpandedChange = { faultDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selectedFaultCode?.let { "${it.code} — ${it.name}" }
                                ?: stringResource(R.string.complete_fault_code_none),
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = faultDropdownExpanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                                .testTag("fault_code_selector"),
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = BrandNavy,
                                unfocusedBorderColor = LineBorder
                            )
                        )

                        ExposedDropdownMenu(
                            expanded = faultDropdownExpanded,
                            onDismissRequest = { faultDropdownExpanded = false }
                        ) {
                            faultCodes.forEach { code ->
                                DropdownMenuItem(
                                    text = { Text("${code.code} · ${code.name}") },
                                    onClick = {
                                        selectedFaultCode = code
                                        faultDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Материалы
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
                        text = stringResource(R.string.complete_materials_title),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )

                    selectedMaterials.forEachIndexed { index, item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CanvasBg, RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.materialName,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = InkPrimary
                                )
                                Text(
                                    text = "${item.qty} ${item.unit}",
                                    fontSize = 13.sp,
                                    color = InkMuted
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = {
                                        if (item.qty > 1) {
                                            selectedMaterials[index] = item.copy(qty = item.qty - 1)
                                        } else {
                                            selectedMaterials.removeAt(index)
                                        }
                                    }
                                ) {
                                    Icon(imageVector = Icons.Default.Remove, contentDescription = null)
                                }

                                Text(
                                    text = item.qty.toInt().toString(),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp)
                                )

                                IconButton(
                                    onClick = {
                                        selectedMaterials[index] = item.copy(qty = item.qty + 1)
                                    }
                                ) {
                                    Icon(imageVector = Icons.Default.Add, contentDescription = null)
                                }
                            }
                        }
                    }

                    // Добавление материала
                    ExposedDropdownMenuBox(
                        expanded = materialDropdownExpanded,
                        onExpandedChange = { materialDropdownExpanded = it }
                    ) {
                        OutlinedButton(
                            onClick = { materialDropdownExpanded = true },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("add_material_button"),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Text(stringResource(R.string.complete_add_material))
                        }

                        ExposedDropdownMenu(
                            expanded = materialDropdownExpanded,
                            onDismissRequest = { materialDropdownExpanded = false }
                        ) {
                            allMaterials.forEach { mat ->
                                DropdownMenuItem(
                                    text = { Text("${mat.name} (${mat.unit})") },
                                    onClick = {
                                        materialDropdownExpanded = false
                                        val existing = selectedMaterials.indexOfFirst { it.materialId == mat.id }
                                        if (existing >= 0) {
                                            selectedMaterials[existing] = selectedMaterials[existing].copy(
                                                qty = selectedMaterials[existing].qty + 1
                                            )
                                        } else {
                                            selectedMaterials.add(
                                                SelectedMaterial(
                                                    materialId = mat.id,
                                                    materialName = mat.name,
                                                    unit = mat.unit,
                                                    qty = 1.0
                                                )
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Фото «после»
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
                        text = stringResource(R.string.complete_photo_after_title),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = InkPrimary
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(WarningSoft, RoundedCornerShape(8.dp))
                            .padding(10.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.complete_photo_unplanned_hint),
                            fontSize = 13.sp,
                            color = InkPrimary
                        )
                    }

                    if (photoBitmap != null) {
                        Box(
                            modifier = Modifier
                                .size(120.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, LineBorder, RoundedCornerShape(12.dp))
                        ) {
                            Image(
                                bitmap = photoBitmap!!.asImageBitmap(),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    OutlinedButton(
                        onClick = { cameraLauncher.launch() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .testTag("take_photo_button"),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null)
                        Spacer(modifier = Modifier.size(8.dp))
                        Text(stringResource(R.string.action_take_photo))
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Главная кнопка отправки на проверку (56 dp min)
            Button(
                onClick = { submit() },
                enabled = !isSubmitting,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .testTag("submit_complete_button")
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = stringResource(R.string.complete_submit_btn),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}
