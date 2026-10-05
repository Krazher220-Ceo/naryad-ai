package kz.naryadai.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kz.naryadai.app.data.WorkOrder
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Line
import kz.naryadai.app.ui.theme.Oswald
import kz.naryadai.app.ui.theme.Surface
import kz.naryadai.app.util.formatDateTime
import kz.naryadai.app.util.minutesLate

// Карточка наряда: «№номер» первым, затем описание (2 строки), исполнитель, оборудование и участок, срок, плашки.
// Аварийный наряд — красная рамка 2 dp и красная полоса слева 8 dp.
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OrderCard(order: WorkOrder, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val emergency = order.priority == "emergency"
    val late = if (order.status in OPEN_STATUSES) minutesLate(order.dueAt) else null
    val shape = RoundedCornerShape(16.dp)
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 72.dp),
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = Surface),
        border = BorderStroke(if (emergency) 2.dp else 1.dp, if (emergency) Danger else Line),
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            if (emergency) {
                Box(Modifier.width(8.dp).fillMaxHeight().background(Danger))
            }
            Column(Modifier.weight(1f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "№${order.number}",
                        style = MaterialTheme.typography.headlineSmall.copy(fontFamily = Oswald),
                        color = if (emergency) Danger else Ink,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(Icons.Filled.Schedule, contentDescription = null, tint = if (late != null) Danger else InkMuted, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(
                        formatDateTime(order.dueAt),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = if (late != null) Danger else Ink,
                    )
                }
                Text(
                    order.description,
                    style = MaterialTheme.typography.titleSmall,
                    color = Ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val place = listOfNotNull(order.equipment?.name, order.section?.name).filter { it.isNotBlank() }.joinToString(" · ")
                if (place.isNotBlank()) {
                    Text(place, style = MaterialTheme.typography.bodyMedium, color = InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                order.assignee?.fullName?.takeIf { it.isNotBlank() }?.let { name ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Person, contentDescription = null, tint = InkMuted, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(name, style = MaterialTheme.typography.bodyMedium, color = InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PriorityBadge(order.priority)
                    StatusBadge(order.status)
                    if (late != null) OverdueTag(late)
                }
            }
        }
    }
}
