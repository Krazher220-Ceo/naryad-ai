// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.util

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val timeFmt = DateTimeFormatter.ofPattern("HH:mm")
private val dateTimeFmt = DateTimeFormatter.ofPattern("dd.MM HH:mm")

private fun parse(iso: String): Instant? = runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrNull()

// «14:30» для сегодняшних сроков, «06.10 14:30» для остальных
fun formatDateTime(iso: String): String {
    val instant = parse(iso) ?: return ""
    val local = instant.atZone(ZoneId.systemDefault())
    return if (local.toLocalDate() == LocalDate.now()) timeFmt.format(local) else dateTimeFmt.format(local)
}

// Только показ: срок наряда уже прошёл. Решение «просрочен или нет» принимает сервер, здесь — подпись.
fun minutesLate(dueIso: String): Long? {
    val due = parse(dueIso) ?: return null
    val minutes = Duration.between(due, Instant.now()).toMinutes()
    return if (minutes > 0) minutes else null
}

fun initials(fullName: String): String =
    fullName.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
