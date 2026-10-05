package kz.naryadai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.InfoSoft
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.LineStrong
import kz.naryadai.app.ui.theme.Surface

val REJECT_REASONS = listOf("no_materials", "no_permit", "busy_emergency", "other")
val PAUSE_REASONS = listOf("waiting_parts", "waiting_permit", "waiting_stop", "other")

private fun reasonRes(code: String): Int = when (code) {
    "no_materials" -> R.string.reason_no_materials
    "no_permit" -> R.string.reason_no_permit
    "busy_emergency" -> R.string.reason_busy_emergency
    "waiting_parts" -> R.string.reason_waiting_parts
    "waiting_permit" -> R.string.reason_waiting_permit
    "waiting_stop" -> R.string.reason_waiting_stop
    else -> R.string.reason_other
}

@Composable
fun reasonLabel(code: String): String = stringResource(reasonRes(code))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppSheet(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Surface,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
    ) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) { content() }
    }
}

// Лист с обязательной причиной для паузы и отказа. Пока причина не выбрана, кнопка неактивна.
@Composable
fun ReasonSheet(
    title: String,
    description: String,
    codes: List<String>,
    confirmLabel: String,
    onConfirm: (reasonCode: String, reasonText: String?) -> Unit,
    onDismiss: () -> Unit,
    loading: Boolean = false,
) {
    var selected by rememberSaveable { mutableStateOf("") }
    var text by rememberSaveable { mutableStateOf("") }
    val valid = selected.isNotEmpty() && (selected != "other" || text.isNotBlank())
    AppSheet(onDismiss) {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = Ink)
        Text(description, style = MaterialTheme.typography.bodyMedium, color = InkMuted)
        codes.forEach { code ->
            val isSelected = selected == code
            Row(
                Modifier.fillMaxWidth().heightIn(min = 56.dp)
                    .background(if (isSelected) InfoSoft else Surface, RoundedCornerShape(12.dp))
                    .border(if (isSelected) 2.dp else 1.5.dp, if (isSelected) Brand else LineStrong, RoundedCornerShape(12.dp))
                    .clickable { selected = code }
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(
                    selected = isSelected,
                    onClick = { selected = code },
                    colors = RadioButtonDefaults.colors(selectedColor = Brand, unselectedColor = LineStrong),
                )
                Text(reasonLabel(code), style = MaterialTheme.typography.bodyLarge.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = Ink)
            }
        }
        if (selected == "other") {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.reason_other_placeholder)) },
                minLines = 2,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyLarge,
            )
        }
        Spacer(Modifier.height(4.dp))
        PrimaryButton(
            confirmLabel,
            onClick = { onConfirm(selected, if (selected == "other") text.trim() else null) },
            enabled = valid,
            loading = loading,
            danger = true,
        )
        SecondaryButton(stringResource(R.string.cancel), onDismiss, Modifier.fillMaxWidth())
    }
}

// Проверка безопасности перед «Начать исполнение»: каждый пункт нужно отметить
@Composable
fun SafetySheet(needsPermit: Boolean, onConfirm: () -> Unit, onDismiss: () -> Unit, loading: Boolean = false) {
    val items = buildList {
        add(R.string.safety_stopped)
        add(R.string.safety_locked)
        add(R.string.safety_ppe)
        if (needsPermit) add(R.string.safety_permit)
    }
    var checked by remember { mutableStateOf(setOf<Int>()) }
    AppSheet(onDismiss) {
        Text(stringResource(R.string.safety_title), style = MaterialTheme.typography.headlineSmall, color = Ink)
        Text(stringResource(R.string.safety_text), style = MaterialTheme.typography.bodyMedium, color = InkMuted)
        items.forEach { res ->
            val isChecked = res in checked
            Row(
                Modifier.fillMaxWidth().heightIn(min = 56.dp)
                    .background(if (isChecked) InfoSoft else Surface, RoundedCornerShape(12.dp))
                    .border(if (isChecked) 2.dp else 1.5.dp, if (isChecked) Brand else LineStrong, RoundedCornerShape(12.dp))
                    .clickable { checked = if (isChecked) checked - res else checked + res }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = isChecked,
                    onCheckedChange = { checked = if (isChecked) checked - res else checked + res },
                    colors = CheckboxDefaults.colors(checkedColor = Brand, uncheckedColor = LineStrong),
                )
                Text(stringResource(res), style = MaterialTheme.typography.bodyLarge, color = Ink)
            }
        }
        Spacer(Modifier.height(4.dp))
        PrimaryButton(stringResource(R.string.safety_submit), onClick = onConfirm, enabled = checked.size == items.size, loading = loading)
        SecondaryButton(stringResource(R.string.cancel), onDismiss, Modifier.fillMaxWidth())
    }
}

// «Позвать мастера»: комментарий по желанию, статус наряда не меняется
@Composable
fun HelpSheet(onConfirm: (String) -> Unit, onDismiss: () -> Unit, loading: Boolean = false) {
    var text by rememberSaveable { mutableStateOf("") }
    AppSheet(onDismiss) {
        Text(stringResource(R.string.help_title), style = MaterialTheme.typography.headlineSmall, color = Ink)
        Text(stringResource(R.string.help_text), style = MaterialTheme.typography.bodyMedium, color = InkMuted)
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.help_comment_label)) },
            placeholder = { Text(stringResource(R.string.help_comment_placeholder)) },
            minLines = 3,
            shape = RoundedCornerShape(12.dp),
            textStyle = MaterialTheme.typography.bodyLarge,
        )
        PrimaryButton(stringResource(R.string.help_submit), onClick = { onConfirm(text.trim()) }, loading = loading)
        SecondaryButton(stringResource(R.string.cancel), onDismiss, Modifier.fillMaxWidth())
    }
}
