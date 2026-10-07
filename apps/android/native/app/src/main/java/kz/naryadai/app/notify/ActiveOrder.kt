// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.notify

import kz.naryadai.app.data.WorkOrder
import java.time.OffsetDateTime

// Какой наряд показывать в «живом» уведомлении. Только выбор для показа:
// статусы и сроки считает сервер, мы лишь берём из уже загруженного списка.
private val ACTIVE_STATUSES = setOf("accepted", "in_progress", "paused", "rework")

fun dueEpochMs(o: WorkOrder): Long? =
    runCatching { OffsetDateTime.parse(o.dueAt).toInstant().toEpochMilli() }.getOrNull()

// Сначала аварийный, потом тот, что сейчас в работе, потом ближайший срок
fun pickActiveOrder(orders: List<WorkOrder>): WorkOrder? =
    orders.filter { it.status in ACTIVE_STATUSES }
        .sortedWith(
            compareBy<WorkOrder> { it.priority != "emergency" }
                .thenBy { it.status != "in_progress" }
                .thenBy { dueEpochMs(it) ?: Long.MAX_VALUE },
        )
        .firstOrNull()
