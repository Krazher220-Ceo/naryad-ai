// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import kz.naryadai.app.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

// Сервер ответил отказом. Текст показываем пользователю как есть.
class ApiException(val status: Int, message: String) : Exception(message)

// Вход прошёл, но учётная запись не привязана к сотруднику
class NoProfileException : Exception()

// Вошёл не исполнитель: приложение только для исполнителей
class NotWorkerException : Exception()

// Весь обмен по сети. Чтение идёт напрямую в Supabase (PostgREST) с токеном пользователя,
// а все изменения — только через маршруты веб-приложения /api/mobile/...
class Api(private val session: Session) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val supabase = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val web = BuildConfig.WEB_APP_URL.trimEnd('/')
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY
    private val jsonType = "application/json".toMediaType()

    // ---------- Вход и выход ----------

    suspend fun login(login: String, password: String): Employee = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("email", "${login.trim().lowercase()}@naryad.local")
            put("password", password)
        }
        val request = Request.Builder()
            .url("$supabase/auth/v1/token?grant_type=password")
            .header("apikey", anonKey)
            .post(body.toString().toRequestBody(jsonType))
            .build()
        val userId = http.newCall(request).execute().use { r ->
            val text = r.body?.string().orEmpty()
            if (!r.isSuccessful) throw ApiException(r.code, errorText(text))
            val o = AppJson.parseToJsonElement(text).jsonObject
            session.saveTokens(
                o.getValue("access_token").jsonPrimitive.content,
                o.getValue("refresh_token").jsonPrimitive.content,
                o["expires_in"]?.jsonPrimitive?.long ?: 3600,
            )
            o.getValue("user").jsonObject.getValue("id").jsonPrimitive.content
        }
        val rows = AppJson.decodeFromString<List<Employee>>(
            get("/rest/v1/employees?auth_user_id=eq.$userId&select=id,full_name,role,login"),
        )
        val employee = rows.firstOrNull() ?: run {
            logout()
            throw NoProfileException()
        }
        employee
    }

    // Выход только с этого устройства (scope=local). Сеть для выхода не обязательна.
    suspend fun logout() = withContext(Dispatchers.IO) {
        val token = session.accessToken
        if (token != null) {
            runCatching {
                val request = Request.Builder()
                    .url("$supabase/auth/v1/logout?scope=local")
                    .header("apikey", anonKey)
                    .header("Authorization", "Bearer $token")
                    .post("{}".toRequestBody(jsonType))
                    .build()
                http.newCall(request).execute().close()
            }
        }
        session.clear()
    }

    // Обновляет токен. true — получилось. IOException — нет сети (вход не сбрасываем).
    @Synchronized
    private fun refresh(): Boolean {
        val refreshToken = session.refreshToken ?: return false
        val body = buildJsonObject { put("refresh_token", refreshToken) }
        val request = Request.Builder()
            .url("$supabase/auth/v1/token?grant_type=refresh_token")
            .header("apikey", anonKey)
            .post(body.toString().toRequestBody(jsonType))
            .build()
        http.newCall(request).execute().use { r ->
            val text = r.body?.string().orEmpty()
            if (r.isSuccessful) {
                val o = AppJson.parseToJsonElement(text).jsonObject
                session.saveTokens(
                    o.getValue("access_token").jsonPrimitive.content,
                    o.getValue("refresh_token").jsonPrimitive.content,
                    o["expires_in"]?.jsonPrimitive?.long ?: 3600,
                )
                return true
            }
            if (r.code in 400..499) {
                // Токен обновления недействителен: возвращаем на экран входа
                session.clear()
                return false
            }
            throw IOException("refresh failed: ${r.code}")
        }
    }

    // ---------- Запросы ----------

    // Выполняет запрос с токеном. Если токен скоро истечёт или сервер вернул 401 — обновляет и повторяет один раз.
    private fun execute(build: (token: String) -> Request): Response {
        if (session.accessToken == null) throw ApiException(401, "Unauthorized")
        if (System.currentTimeMillis() > session.expiresAtMs - 60_000) {
            if (!refresh()) throw ApiException(401, "Unauthorized")
        }
        var response = http.newCall(build(session.accessToken!!)).execute()
        if (response.code == 401) {
            response.close()
            if (!refresh()) throw ApiException(401, "Unauthorized")
            response = http.newCall(build(session.accessToken!!)).execute()
        }
        return response
    }

    private fun read(response: Response): String = response.use { r ->
        val text = r.body?.string().orEmpty()
        if (!r.isSuccessful) throw ApiException(r.code, errorText(text))
        text
    }

    private fun Request.Builder.restHeaders(token: String) =
        header("apikey", anonKey).header("Authorization", "Bearer $token")

    // Чтение из PostgREST, например "/rest/v1/work_orders?select=*"
    suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        read(execute { token -> Request.Builder().url(supabase + path).restHeaders(token).get().build() })
    }

    suspend fun rpc(function: String, body: JsonObject): String = withContext(Dispatchers.IO) {
        read(
            execute { token ->
                Request.Builder().url("$supabase/rest/v1/rpc/$function").restHeaders(token)
                    .post(body.toString().toRequestBody(jsonType)).build()
            },
        )
    }

    // Действия: POST на маршрут веб-приложения, например "/api/mobile/orders/{id}/transition"
    suspend fun postRoute(path: String, body: String): String = withContext(Dispatchers.IO) {
        fun send() = execute { token ->
            Request.Builder().url(web + path).header("Authorization", "Bearer $token")
                .post(body.toRequestBody(jsonType)).build()
        }
        try {
            read(send())
        } catch (e: ApiException) {
            // Маршрут оборачивает ошибку просроченного токена в 400. Обновляем токен и повторяем.
            if (e.message?.contains("JWT", ignoreCase = true) == true && refresh()) read(send()) else throw e
        }
    }

    suspend fun uploadPhoto(storagePath: String, bytes: ByteArray) = withContext(Dispatchers.IO) {
        try {
            read(
                execute { token ->
                    Request.Builder().url("$supabase/storage/v1/object/photos/$storagePath").restHeaders(token)
                        .post(bytes.toRequestBody("image/jpeg".toMediaType())).build()
                },
            )
        } catch (e: ApiException) {
            // Файл уже загружен прошлой попыткой — это не ошибка
            val dup = e.message?.contains("already exists", ignoreCase = true) == true
            if (!dup) throw e
        }
        Unit
    }

    // Временная ссылка на фото из закрытого bucket
    suspend fun signedPhotoUrl(storagePath: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            val body = buildJsonObject { put("expiresIn", 3600) }
            val text = read(
                execute { token ->
                    Request.Builder().url("$supabase/storage/v1/object/sign/photos/$storagePath").restHeaders(token)
                        .post(body.toString().toRequestBody(jsonType)).build()
                },
            )
            val signed = AppJson.parseToJsonElement(text).jsonObject["signedURL"]?.jsonPrimitive?.contentOrNull
            signed?.let { "$supabase/storage/v1" + if (it.startsWith("/")) it else "/$it" }
        }.getOrNull()
    }

    // Достаёт текст ошибки из ответа Supabase или веб-маршрута
    private fun errorText(raw: String): String {
        val fallback = raw.take(200).ifBlank { "Error" }
        val el: JsonElement = runCatching { AppJson.parseToJsonElement(raw) }.getOrNull() ?: return fallback
        val o = el as? JsonObject ?: return fallback
        for (key in listOf("error", "message", "error_description", "msg")) {
            val v = o[key]
            if (v is JsonPrimitive && v.isString && v.content.isNotBlank()) return v.content
        }
        return fallback
    }
}
