// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.Accent
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.LineStrong
import kz.naryadai.app.ui.theme.Success
import kz.naryadai.app.ui.theme.Surface

// ---------- Шапка ----------

// Тёмно-синяя шапка с жёлтой полосой внизу. Справа — плашка связи (на телефоне сверху справа).
@Composable
fun BrandHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    trailing: @Composable () -> Unit = {},
) {
    Column(modifier.fillMaxWidth().background(Brand)) {
        Row(
            Modifier.statusBarsPadding().heightIn(min = 64.dp).padding(start = if (onBack != null) 4.dp else 20.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.size(56.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back), tint = Color.White)
                }
            }
            Column(Modifier.weight(1f).padding(vertical = 10.dp)) {
                Text(title, style = MaterialTheme.typography.headlineSmall, color = Color.White, maxLines = 1)
                if (subtitle != null) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.85f), maxLines = 1)
                }
            }
            Spacer(Modifier.width(8.dp))
            trailing()
        }
        Box(Modifier.fillMaxWidth().height(4.dp).background(Accent))
    }
}

// Плашка связи: «В сети», «Нет связи · 2», «Отправка · 1»
@Composable
fun ConnectionPill(online: Boolean, pending: Int, modifier: Modifier = Modifier) {
    val (dot, text) = when {
        !online && pending > 0 -> Danger to stringResource(R.string.conn_offline_n, pending)
        !online -> Danger to stringResource(R.string.conn_offline)
        pending > 0 -> Accent to stringResource(R.string.conn_sending_n, pending)
        else -> Success to stringResource(R.string.conn_online)
    }
    Row(
        modifier.height(36.dp).background(Surface, RoundedCornerShape(18.dp)).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).border(1.5.dp, Ink, CircleShape).background(dot, CircleShape))
        Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.labelMedium.copy(fontSize = 14.sp), color = Ink, maxLines = 1)
    }
}

// ---------- Кнопки (высота от 56 dp) ----------

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    danger: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(56.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (danger) Danger else Brand,
            contentColor = Color.White,
            disabledContainerColor = Line,
            disabledContentColor = InkMuted,
        ),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(24.dp), color = Color.White, strokeWidth = 3.dp)
        } else {
            Text(text, style = MaterialTheme.typography.labelLarge.copy(fontSize = 17.sp, lineHeight = 20.sp), textAlign = TextAlign.Center, maxLines = 2)
        }
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    danger: Boolean = false,
    leading: ImageVector? = null,
) {
    val color = if (danger) Danger else Brand
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 56.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.5.dp, if (enabled) color else Line),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Surface, contentColor = color, disabledContentColor = InkMuted),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    ) {
        if (leading != null) {
            Icon(leading, contentDescription = null, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge.copy(fontSize = 16.sp, lineHeight = 20.sp), textAlign = TextAlign.Center, maxLines = 2)
    }
}

// Панель главного действия внизу экрана
@Composable
fun BottomActionBar(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier.fillMaxWidth().background(Surface)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Line))
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) { content() }
    }
}

// ---------- Состояния ----------

@Composable
fun EmptyState(icon: ImageVector, title: String, text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(88.dp).background(Color(0xFFD4E4FD), CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Brand, modifier = Modifier.size(44.dp))
        }
        Text(title, style = MaterialTheme.typography.titleMedium, color = Ink, textAlign = TextAlign.Center)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = InkMuted, textAlign = TextAlign.Center)
        if (action != null) {
            Spacer(Modifier.height(4.dp))
            action()
        }
    }
}

@Composable
fun ErrorState(text: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    EmptyState(
        icon = Icons.Filled.ErrorOutline,
        title = stringResource(R.string.error_title),
        text = text,
        modifier = modifier,
        action = { SecondaryButton(stringResource(R.string.retry), onRetry, Modifier.width(220.dp)) },
    )
}

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Brand)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier, style = MaterialTheme.typography.titleSmall, color = Ink)
}

// Белая карточка с рамкой
@Composable
fun InfoCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier.fillMaxWidth().background(Surface, RoundedCornerShape(16.dp)).border(1.dp, Line, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) { content() }
}

@Composable
fun LabeledValue(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = InkMuted)
        Text(value, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = Ink)
    }
}

val FieldBorder = LineStrong
val ScreenBackground = Canvas
