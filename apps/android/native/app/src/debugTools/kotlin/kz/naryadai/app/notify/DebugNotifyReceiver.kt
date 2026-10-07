// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kz.naryadai.app.Graph
import kz.naryadai.app.data.AppNotification
import kz.naryadai.app.data.Named
import kz.naryadai.app.data.WorkOrder
import java.time.Instant

// Только debug. Показывает уведомления с выдуманным нарядом, в базу ничего не пишет.
//   adb shell am broadcast -n kz.naryadai.app/.notify.DebugNotifyReceiver -a ongoing \
//     --es status in_progress --ei due_min 45 [--es priority emergency] [--es reason "Нет детали"]
//   adb shell am broadcast -n kz.naryadai.app/.notify.DebugNotifyReceiver -a incoming \
//     --es kind new_order [--es priority emergency]
// Живое уведомление затирается следующим опросом службы, если состояние в базе другое.
class DebugNotifyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val c = Notifier.localized(context, Graph.session.language.value)
        Channels.ensure(c)
        val priority = intent.getStringExtra("priority") ?: "normal"
        val order = WorkOrder(
            id = "debug-order",
            number = intent.getIntExtra("number", 598),
            priority = priority,
            status = intent.getStringExtra("status") ?: "in_progress",
            dueAt = Instant.now().plusSeconds(intent.getIntExtra("due_min", 45) * 60L).toString(),
            equipment = Named(name = "Насос шламовый НШ-2"),
            section = Named(name = "Участок обогащения"),
        )
        when (intent.action) {
            "ongoing" -> Notifier.postOngoing(context, Notifier.buildOngoing(c, order, intent.getStringExtra("reason")))
            "incoming" -> Notifier.postIncoming(
                c,
                AppNotification(
                    id = "debug-" + System.nanoTime(),
                    kind = intent.getStringExtra("kind") ?: "new_order",
                    text = intent.getStringExtra("text") ?: "Новый наряд №${order.number}: ${order.equipment?.name}",
                    orderId = order.id,
                    createdAt = Instant.now().toString(),
                ),
                order,
            )
        }
    }
}
