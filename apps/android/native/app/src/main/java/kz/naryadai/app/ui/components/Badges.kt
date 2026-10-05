package kz.naryadai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.*

// Подписи берутся из strings.xml по коду, который пришёл с сервера.

fun priorityLabelRes(priority: String): Int = when (priority) {
    "emergency" -> R.string.priority_emergency
    "high" -> R.string.priority_high
    "planned" -> R.string.priority_planned
    else -> R.string.priority_normal
}

fun statusLabelRes(status: String): Int = when (status) {
    "issued" -> R.string.status_issued
    "accepted" -> R.string.status_accepted
    "queued" -> R.string.status_queued
    "rejected" -> R.string.status_rejected
    "in_progress" -> R.string.status_in_progress
    "paused" -> R.string.status_paused
    "done" -> R.string.status_done
    "ai_review" -> R.string.status_ai_review
    "rework" -> R.string.status_rework
    "closed" -> R.string.status_closed
    else -> R.string.status_cancelled
}

private fun statusColors(status: String): Pair<Color, Color> = when (status) {
    "issued" -> StIssuedBg to StIssuedFg
    "accepted" -> StAcceptedBg to StAcceptedFg
    "queued" -> StQueuedBg to StQueuedFg
    "rejected" -> StRejectedBg to StRejectedFg
    "in_progress" -> StInProgressBg to StInProgressFg
    "paused" -> StPausedBg to StPausedFg
    "done" -> StDoneBg to StDoneFg
    "ai_review" -> StAiReviewBg to StAiReviewFg
    "rework" -> StReworkBg to StReworkFg
    "closed" -> StClosedBg to StClosedFg
    else -> StCancelledBg to StCancelledFg
}

private fun priorityColor(priority: String): Color = when (priority) {
    "emergency" -> PrioEmergency
    "high" -> PrioHigh
    "planned" -> PrioPlanned
    else -> PrioNormal
}

// Статусы, в которых срок ещё имеет смысл показывать как просрочку (только для подписи)
val OPEN_STATUSES = setOf("issued", "accepted", "queued", "rejected", "in_progress", "paused", "rework")

@Composable
fun PriorityBadge(priority: String, modifier: Modifier = Modifier) {
    Row(
        modifier.background(priorityColor(priority), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (priority == "emergency") {
            Icon(Icons.Filled.Warning, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
        }
        Text(
            stringResource(priorityLabelRes(priority)),
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
            color = Color.White,
        )
    }
}

@Composable
fun StatusBadge(status: String, modifier: Modifier = Modifier) {
    val (bg, fg) = statusColors(status)
    Row(
        modifier.background(bg, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).background(fg, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(
            stringResource(statusLabelRes(status)),
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
            color = fg,
        )
    }
}

// «Просрочен на 25 мин»: красная рамка и значок часов
@Composable
fun OverdueTag(minutes: Long, modifier: Modifier = Modifier) {
    val time = if (minutes >= 60) {
        stringResource(R.string.time_hours, minutes / 60, minutes % 60)
    } else {
        stringResource(R.string.time_minutes, minutes)
    }
    Row(
        modifier.border(1.5.dp, Danger, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Schedule, contentDescription = null, tint = Danger, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(4.dp))
        Text(
            stringResource(R.string.overdue_by, time),
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
            color = Danger,
        )
    }
}
