// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.notify

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import java.time.OffsetDateTime

// Служба переднего плана: пока исполнитель вошёл в приложение, держит в шторке «живое»
// уведомление о наряде и каждые 20 секунд спрашивает у базы новые уведомления.
// Тип specialUse: dataSync на Android 15 ограничен 6 часами в сутки, а смена длиннее.
// Решений здесь нет: служба только показывает то, что уже решил сервер.
class WorkerService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loop: Job? = null

    // Что уже показано в живом уведомлении (чтобы не перерисовывать без причины)
    private var shownSignature: String? = null
    private var pauseOrderKey: String? = null
    private var pauseReason: String? = null

    private fun ctx(): Context = Notifier.localized(this, Graph.session.language.value)

    override fun onCreate() {
        super.onCreate()
        Channels.ensure(ctx())
        try {
            val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
            ServiceCompat.startForeground(this, Notifier.ONGOING_ID, Notifier.buildIdle(ctx()), type)
        } catch (_: Exception) {
            // Система не разрешила запуск из фона: просто не работаем, приложение запустит службу при открытии
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!Graph.session.isLoggedIn) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (loop == null) {
            loop = scope.launch {
                while (isActive) {
                    // Вышли из аккаунта или отключили уведомления: службе делать нечего, батарею не тратим
                    if (!Graph.session.isLoggedIn || !Notifier.canPost(this@WorkerService)) {
                        stopSelf()
                        break
                    }
                    runCatching { tick() }
                    delay(POLL_MS)
                }
            }
        }
        return START_STICKY
    }

    // Один проход: обновить данные, перерисовать живое уведомление, показать новые уведомления
    private suspend fun tick() {
        val repo = Graph.repo
        repo.refreshAll()
        val c = ctx()
        updateOngoing(c)
        postNewNotifications(c)
    }

    private suspend fun updateOngoing(c: Context) {
        val orders = Graph.repo.orders.value
        val order = pickActiveOrder(orders)
        if (order == null) {
            show("idle|" + Graph.session.language.value) { Notifier.buildIdle(c) }
            return
        }
        if (order.status == "paused") {
            val key = order.id + (order.updatedAt ?: "")
            if (key != pauseOrderKey) {
                pauseReason = Graph.repo.lastPauseReason(order.id)
                pauseOrderKey = key
            }
        }
        val now = System.currentTimeMillis()
        val due = dueEpochMs(order)
        val lateMin = if (due != null && now > due) (now - due) / 60_000 else -1
        val sig = listOf(order.id, order.status, order.priority, order.dueAt, pauseReason, lateMin, Graph.session.language.value).joinToString("|")
        show(sig) { Notifier.buildOngoing(c, order, if (order.status == "paused") pauseReason else null, now) }
    }

    private inline fun show(signature: String, build: () -> android.app.Notification) {
        if (signature == shownSignature) return
        shownSignature = signature
        Notifier.postOngoing(this, build())
    }

    private fun postNewNotifications(c: Context) {
        val session = Graph.session
        val list = Graph.repo.notifications.value
        val times = list.associateWith { runCatching { OffsetDateTime.parse(it.createdAt).toInstant().toEpochMilli() }.getOrDefault(0L) }
        val seen = session.notifSeenMs
        if (seen == 0L) {
            // Первый запуск: старые уведомления не показываем, запоминаем границу
            session.notifSeenMs = times.values.maxOrNull() ?: 1L
            return
        }
        val fresh = list.filter { it.readAt == null && (times[it] ?: 0L) > seen }.sortedBy { times[it] }
        if (fresh.isEmpty()) return
        val orders = Graph.repo.orders.value
        fresh.takeLast(MAX_PER_TICK).forEach { n ->
            Notifier.postIncoming(c, n, n.orderId?.let { id -> orders.firstOrNull { it.id == id } })
        }
        session.notifSeenMs = fresh.maxOf { times[it] ?: 0L }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val POLL_MS = 20_000L
        private const val MAX_PER_TICK = 5

        // Запускаем только из открытого приложения (из фона Android не даёт) и только при включённых уведомлениях
        fun start(ctx: Context) {
            if (!Graph.session.isLoggedIn || !Notifier.canPost(ctx)) return
            runCatching { ctx.startForegroundService(Intent(ctx, WorkerService::class.java)) }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, WorkerService::class.java))
            androidx.core.app.NotificationManagerCompat.from(ctx).cancelAll()
        }
    }
}
