package kz.naryadai.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.DangerRed

@Composable
fun OfflineBanner(
    isOffline: Boolean,
    pendingCount: Int = 0,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = isOffline || pendingCount > 0,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = modifier
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DangerRed)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.WifiOff,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier
                    .size(18.dp)
                    .padding(end = 4.dp)
            )
            val text = if (isOffline) {
                if (pendingCount > 0) {
                    "${stringResource(R.string.offline_banner)} · ${stringResource(R.string.profile_offline_queue, pendingCount)}"
                } else {
                    stringResource(R.string.offline_banner)
                }
            } else {
                stringResource(R.string.profile_offline_queue, pendingCount)
            }
            Text(
                text = text,
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
