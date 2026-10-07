// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import kz.naryadai.app.R

// Четыре канала: пользователь сам настраивает каждый в системных настройках
object Channels {
    const val NEW_ORDERS = "new_orders"
    const val EMERGENCY = "emergency_v1"
    const val DEADLINES = "deadlines"
    const val CURRENT = "current_order"

    // ctx — контекст с нужным языком, чтобы названия были на языке приложения
    fun ensure(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(NEW_ORDERS, ctx.getString(R.string.channel_new_orders), NotificationManager.IMPORTANCE_HIGH)
                .apply { description = ctx.getString(R.string.channel_new_orders_desc) },
        )
        nm.createNotificationChannel(
            NotificationChannel(EMERGENCY, ctx.getString(R.string.channel_emergency), NotificationManager.IMPORTANCE_HIGH).apply {
                description = ctx.getString(R.string.channel_emergency_desc)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 600, 200, 600, 200, 900)
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(DEADLINES, ctx.getString(R.string.channel_deadlines), NotificationManager.IMPORTANCE_DEFAULT)
                .apply { description = ctx.getString(R.string.channel_deadlines_desc) },
        )
        nm.createNotificationChannel(
            NotificationChannel(CURRENT, ctx.getString(R.string.channel_current), NotificationManager.IMPORTANCE_LOW).apply {
                description = ctx.getString(R.string.channel_current_desc)
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            },
        )
    }
}
