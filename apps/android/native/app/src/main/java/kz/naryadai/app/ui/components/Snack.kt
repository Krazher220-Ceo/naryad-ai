// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kz.naryadai.app.data.ActionResult
import kz.naryadai.app.ui.theme.Ink

// Всплывающее сообщение внизу экрана. Тексты только из словаря, ошибки сервера — как пришли.
@Composable
fun AppSnackbarHost(state: SnackbarHostState, modifier: Modifier = Modifier) {
    SnackbarHost(state, modifier) { data ->
        Snackbar(
            snackbarData = data,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            shape = RoundedCornerShape(12.dp),
            containerColor = Ink,
            contentColor = Color.White,
        )
    }
}

suspend fun SnackbarHostState.showResult(result: ActionResult, saved: String, offline: String) {
    currentSnackbarData?.dismiss()
    when (result) {
        ActionResult.Sent -> showSnackbar(saved, duration = SnackbarDuration.Short)
        ActionResult.Queued -> showSnackbar(offline, duration = SnackbarDuration.Long)
        is ActionResult.Failed -> showSnackbar(result.message, duration = SnackbarDuration.Long)
    }
}
