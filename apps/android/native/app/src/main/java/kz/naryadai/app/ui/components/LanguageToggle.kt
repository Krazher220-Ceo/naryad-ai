// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.Accent
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.LineStrong
import kz.naryadai.app.ui.theme.Surface

// Переключатель Рус / Қаз. onDark — для синего фона (экран входа).
@Composable
fun LanguageToggle(modifier: Modifier = Modifier, onDark: Boolean = false, minItemWidth: androidx.compose.ui.unit.Dp = 64.dp) {
    val current by Graph.session.language.collectAsState()
    val border = if (onDark) Color.White.copy(alpha = 0.6f) else LineStrong
    Row(modifier.height(48.dp).border(1.5.dp, border, RoundedCornerShape(12.dp)).background(if (onDark) Color.Transparent else Surface, RoundedCornerShape(12.dp))) {
        listOf("ru" to R.string.lang_ru, "kk" to R.string.lang_kk).forEach { (code, label) ->
            val selected = current == code
            val bg = when {
                selected && onDark -> Accent
                selected -> Brand
                else -> Color.Transparent
            }
            val fg = when {
                selected && onDark -> Ink
                selected -> Color.White
                onDark -> Color.White
                else -> Ink
            }
            Box(
                Modifier.widthIn(min = minItemWidth).height(48.dp).background(bg, RoundedCornerShape(11.dp))
                    .clickable { Graph.session.setLanguage(code) },
                contentAlignment = Alignment.Center,
            ) {
                Text(stringResource(label), style = MaterialTheme.typography.labelLarge, color = fg)
            }
        }
    }
}
