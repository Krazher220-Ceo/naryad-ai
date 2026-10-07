// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.notify

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kz.naryadai.app.MainActivity
import kz.naryadai.app.R
import kz.naryadai.app.data.AppNotification
import kz.naryadai.app.data.WorkOrder
import kz.naryadai.app.ui.components.statusLabelRes
import java.util.Locale

// Куда открыть приложение по нажатию на уведомление: "order/<id>" или "notifications".
// MainActivity кладёт сюда адрес, AppRoot переходит и очищает.
object DeepLink {
    const val EXTRA = "open"
    val target = MutableStateFlow<String?>(null)
}

// Только показ: тексты и каналы. Статусы и права здесь не решаются.
object Notifier {
    const val ONGOING_ID = 1001
    private const val RED = 0xFFB91C1C.toInt()
    private const val BRAND = 0xFF07316E.toInt()

    // Контекст со строками выбранного в приложении языка (ru или kk)
    fun localized(ctx: Context, lang: String): Context {
        val config = Configuration(ctx.resources.configuration).apply { setLocale(Locale(lang)) }
        return ctx.createConfigurationContext(config)
    }

    fun canPost(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled()
    }

    private fun openIntent(ctx: Context, route: String): PendingIntent {
        val intent = Intent(ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(DeepLink.EXTRA, route)
        return PendingIntent.getActivity(ctx, route.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun equipmentLine(o: WorkOrder): String =
        listOfNotNull(o.equipment?.name?.takeIf { it.isNotBlank() }, o.section?.name?.takeIf { it.isNotBlank() }).joinToString(" · ")

    // Постоянное уведомление о наряде в работе (живое уведомление).
    // pauseReason — причина паузы, если известна. nowMs передаём снаружи, чтобы это можно было проверить.
    fun buildOngoing(ctx: Context, order: WorkOrder, pauseReason: String?, nowMs: Long = System.currentTimeMillis()): Notification {
        val due = dueEpochMs(order)
        val paused = order.status == "paused"
        val lateMin = if (due != null && !paused && nowMs > due) (nowMs - due) / 60_000 else null
        val overdue = lateMin != null && lateMin >= 0
        val place = equipmentLine(order)
        val statusText = ctx.getString(statusLabelRes(order.status))
        val headline = when {
            paused && !pauseReason.isNullOrBlank() -> ctx.getString(R.string.live_paused, pauseReason)
            paused -> ctx.getString(R.string.live_paused_no_reason)
            overdue -> ctx.getString(R.string.live_overdue, lateMin.toString())
            else -> null
        }
        // Обычное состояние: «Оборудование · Участок». Пауза и просрочка выходят в первую строку.
        val text = headline ?: place
        val b = NotificationCompat.Builder(ctx, Channels.CURRENT)
            .setSmallIcon(R.drawable.ic_stat_naryad)
            .setContentTitle(ctx.getString(R.string.live_title, order.number.toString(), statusText))
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(if (headline != null && place.isNotEmpty()) "$headline\n$place" else text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openIntent(ctx, "order/${order.id}"))
            .setColor(if (overdue) RED else BRAND)
            // Android 16: просим показать как живое уведомление (чип в строке состояния)
            .setRequestPromotedOngoing(true)
            .setShortCriticalText(ctx.getString(R.string.live_chip, order.number.toString()))
        if (due != null && !paused) {
            b.setShowWhen(true).setWhen(due).setUsesChronometer(true).setChronometerCountDown(true)
        } else {
            b.setShowWhen(false)
        }
        // Заливка цветом отключает живое уведомление на Android 16, поэтому там остаётся только цвет значка
        if (overdue && Build.VERSION.SDK_INT < 36) b.setColorized(true)
        return b.build()
    }

    // Когда наряда в работе нет: тихая строка «На смене», чтобы служба оставалась в шторке
    fun buildIdle(ctx: Context): Notification =
        NotificationCompat.Builder(ctx, Channels.CURRENT)
            .setSmallIcon(R.drawable.ic_stat_naryad)
            .setContentTitle(ctx.getString(R.string.live_idle_title))
            .setContentText(ctx.getString(R.string.live_idle_text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setColor(BRAND)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openIntent(ctx, "notifications"))
            .build()

    private fun kindTitle(ctx: Context, kind: String): String? = when (kind) {
        "new_order" -> ctx.getString(R.string.notif_kind_new_order)
        "remind" -> ctx.getString(R.string.notif_kind_remind)
        "overdue" -> ctx.getString(R.string.notif_kind_overdue)
        "not_accepted" -> ctx.getString(R.string.notif_kind_not_accepted)
        "lead_overdue" -> ctx.getString(R.string.notif_kind_lead_overdue)
        "review_ready" -> ctx.getString(R.string.notif_kind_review_ready)
        "status_change" -> ctx.getString(R.string.notif_kind_status_change)
        else -> null
    }

    // Канал выбираем по виду уведомления и приоритету наряда
    fun channelFor(n: AppNotification, order: WorkOrder?): String = when {
        order?.priority == "emergency" || n.kind.contains("emergency") -> Channels.EMERGENCY
        n.kind in setOf("remind", "overdue", "not_accepted", "lead_overdue") -> Channels.DEADLINES
        else -> Channels.NEW_ORDERS
    }

    fun buildIncoming(ctx: Context, n: AppNotification, order: WorkOrder?): Notification {
        val channel = channelFor(n, order)
        val emergency = channel == Channels.EMERGENCY
        val route = n.orderId?.let { "order/$it" } ?: "notifications"
        return NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_stat_naryad)
            .setContentTitle(kindTitle(ctx, n.kind) ?: ctx.getString(R.string.app_name))
            .setContentText(n.text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(n.text))
            .setAutoCancel(true)
            .setColor(if (emergency) RED else BRAND)
            .setCategory(if (emergency) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(if (emergency) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openIntent(ctx, route))
            .build()
    }

    @SuppressLint("MissingPermission")
    fun postIncoming(ctx: Context, n: AppNotification, order: WorkOrder?) {
        if (!canPost(ctx)) return
        NotificationManagerCompat.from(ctx).notify(n.id.hashCode(), buildIncoming(ctx, n, order))
    }

    @SuppressLint("MissingPermission")
    fun postOngoing(ctx: Context, n: Notification) {
        if (!canPost(ctx)) return
        NotificationManagerCompat.from(ctx).notify(ONGOING_ID, n)
    }
}
