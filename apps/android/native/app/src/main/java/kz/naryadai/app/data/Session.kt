// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

val AppJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    encodeDefaults = true
}

// Хранит вход (токены), выбранный язык и последние загруженные данные (кэш для работы без сети).
// Всё лежит в закрытых настройках приложения.
class Session(context: Context) {
    private val prefs = context.getSharedPreferences("naryad", Context.MODE_PRIVATE)

    private val _employee = MutableStateFlow(loadEmployee())
    val employee: StateFlow<Employee?> = _employee.asStateFlow()

    private val _language = MutableStateFlow(prefs.getString("lang", "ru") ?: "ru")
    val language: StateFlow<String> = _language.asStateFlow()

    var accessToken: String?
        get() = prefs.getString("access", null)
        private set(v) = prefs.edit().putString("access", v).apply()

    var refreshToken: String?
        get() = prefs.getString("refresh", null)
        private set(v) = prefs.edit().putString("refresh", v).apply()

    var expiresAtMs: Long
        get() = prefs.getLong("expires", 0L)
        private set(v) = prefs.edit().putLong("expires", v).apply()

    val isLoggedIn: Boolean get() = _employee.value != null && refreshToken != null

    // Время последнего уведомления, по которому уже показали системное (0 — ещё не было)
    var notifSeenMs: Long
        get() = prefs.getLong("notif_seen_ms", 0L)
        set(v) = prefs.edit().putLong("notif_seen_ms", v).apply()

    // Объясняли ли уже, зачем нужны уведомления (системный запрос показываем один раз)
    var notifAsked: Boolean
        get() = prefs.getBoolean("notif_asked", false)
        set(v) = prefs.edit().putBoolean("notif_asked", v).apply()

    fun saveTokens(access: String, refresh: String, expiresInSec: Long) {
        accessToken = access
        refreshToken = refresh
        expiresAtMs = System.currentTimeMillis() + expiresInSec * 1000
    }

    fun saveEmployee(e: Employee) {
        prefs.edit().putString("employee", AppJson.encodeToString(e)).apply()
        _employee.value = e
    }

    // Выход только из этого устройства. Кэш и очередь действий не трогаем.
    fun clear() {
        val editor = prefs.edit().remove("access").remove("refresh").remove("expires").remove("employee").remove("notif_seen_ms")
        prefs.all.keys.filter { it.startsWith("cache_") }.forEach { editor.remove(it) }
        editor.apply()
        _employee.value = null
    }

    fun setLanguage(code: String) {
        prefs.edit().putString("lang", code).apply()
        _language.value = code
    }

    fun getCache(key: String): String? = prefs.getString("cache_$key", null)
    fun putCache(key: String, json: String) = prefs.edit().putString("cache_$key", json).apply()

    private fun loadEmployee(): Employee? =
        prefs.getString("employee", null)?.let { runCatching { AppJson.decodeFromString<Employee>(it) }.getOrNull() }
}
