package kz.naryadai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.BrandNavy
import kz.naryadai.app.ui.theme.DangerRed
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InkPrimary
import kz.naryadai.app.ui.theme.SurfaceWhite

data class ReasonOption(
    val code: String,
    val titleRes: Int
)

val STANDARD_REASONS = listOf(
    ReasonOption("no_materials", R.string.reason_no_materials),
    ReasonOption("no_permit", R.string.reason_no_permit),
    ReasonOption("busy_emergency", R.string.reason_busy_emergency),
    ReasonOption("waiting_parts", R.string.reason_waiting_parts),
    ReasonOption("waiting_permit", R.string.reason_waiting_permit),
    ReasonOption("waiting_stop", R.string.reason_waiting_stop),
    ReasonOption("other", R.string.reason_other)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReasonBottomSheet(
    title: String,
    actionButtonText: String,
    isDanger: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (reasonCode: String?, reasonText: String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedCode by remember { mutableStateOf<String?>(null) }
    var customText by remember { mutableStateOf("") }

    val isButtonEnabled = when {
        selectedCode == null -> false
        selectedCode == "other" -> customText.isNotBlank()
        else -> true
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceWhite
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = InkPrimary
            )

            Text(
                text = stringResource(R.string.reason_required_hint),
                fontSize = 14.sp,
                color = InkMuted
            )

            Spacer(modifier = Modifier.height(4.dp))

            STANDARD_REASONS.forEach { reason ->
                val isSelected = selectedCode == reason.code
                val reasonTitle = stringResource(reason.titleRes)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .background(
                            if (isSelected) BrandNavy.copy(alpha = 0.08f) else Color.Transparent,
                            RoundedCornerShape(12.dp)
                        )
                        .clickable { selectedCode = reason.code }
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = isSelected,
                        onClick = { selectedCode = reason.code },
                        colors = RadioButtonDefaults.colors(
                            selectedColor = BrandNavy
                        )
                    )
                    Text(
                        text = reasonTitle,
                        fontSize = 16.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = InkPrimary,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }

            if (selectedCode == "other") {
                OutlinedTextField(
                    value = customText,
                    onValueChange = { customText = it },
                    placeholder = { Text(stringResource(R.string.reason_other_placeholder)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("reason_custom_input"),
                    minLines = 3,
                    maxLines = 5
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    val code = selectedCode
                    val text = if (code == "other") customText.trim() else ""
                    onConfirm(code, text)
                },
                enabled = isButtonEnabled,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isDanger) DangerRed else BrandNavy,
                    disabledContainerColor = Color.LightGray
                ),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .testTag("confirm_reason_button")
            ) {
                Text(
                    text = actionButtonText,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }
    }
}
