package kz.naryadai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kz.naryadai.app.R
import kz.naryadai.app.ui.theme.*

@Composable
fun StatusBadge(
    status: String,
    modifier: Modifier = Modifier
) {
    val (bgColor, fgColor, textRes) = when (status) {
        "issued" -> Triple(StatusIssuedBg, StatusIssuedFg, R.string.status_issued)
        "accepted" -> Triple(StatusAcceptedBg, StatusAcceptedFg, R.string.status_accepted)
        "queued" -> Triple(StatusQueuedBg, StatusQueuedFg, R.string.status_queued)
        "in_progress" -> Triple(StatusInProgressBg, StatusInProgressFg, R.string.status_in_progress)
        "paused" -> Triple(StatusPausedBg, StatusPausedFg, R.string.status_paused)
        "done" -> Triple(StatusDoneBg, StatusDoneFg, R.string.status_done)
        "ai_review" -> Triple(StatusAiReviewBg, StatusAiReviewFg, R.string.status_ai_review)
        "rework" -> Triple(StatusReworkBg, StatusReworkFg, R.string.status_rework)
        "closed" -> Triple(StatusClosedBg, StatusClosedFg, R.string.status_closed)
        "cancelled" -> Triple(StatusCancelledBg, StatusCancelledFg, R.string.status_cancelled)
        "rejected" -> Triple(StatusRejectedBg, StatusRejectedFg, R.string.status_rejected)
        else -> Triple(StatusCancelledBg, StatusCancelledFg, R.string.status_issued)
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = stringResource(textRes),
            color = fgColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun PriorityBadge(
    priority: String,
    modifier: Modifier = Modifier
) {
    val (bgColor, textRes) = when (priority) {
        "emergency" -> Pair(PriorityEmergencyColor, R.string.priority_emergency)
        "high" -> Pair(PriorityHighColor, R.string.priority_high)
        "planned" -> Pair(PriorityPlannedColor, R.string.priority_planned)
        else -> Pair(PriorityNormalColor, R.string.priority_normal)
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = stringResource(textRes),
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun OverdueTag(
    minutesLate: Long = 0,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(DangerSoft)
            .border(1.dp, DangerRed, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = if (minutesLate > 0) {
                stringResource(R.string.overdue_by_min, minutesLate)
            } else {
                stringResource(R.string.overdue_badge)
            },
            color = DangerRed,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun WorkerStatusDot(
    state: String,
    modifier: Modifier = Modifier
) {
    val color = when (state) {
        "free" -> WorkerFreeColor
        "busy" -> WorkerBusyColor
        "queue" -> WorkerQueueColor
        else -> WorkerOffColor
    }

    Box(
        modifier = modifier
            .size(10.dp)
            .clip(CircleShape)
            .background(color)
    )
}
