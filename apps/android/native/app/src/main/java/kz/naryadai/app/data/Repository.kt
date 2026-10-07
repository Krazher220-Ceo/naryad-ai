// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kz.naryadai.app.util.ImageUtils
import java.io.File
import java.io.IOException
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

// Всё, что экран просит у данных. Здесь нет правил статусов и прав: что можно, решает сервер.
// Мы только показываем данные, отправляем действия и храним очередь, пока нет сети.

class DetailData(
    val order: WorkOrder,
    val events: List<OrderEvent>,
    val photos: List<PhotoView>,
    val materials: List<MaterialUsage>,
    val fromCache: Boolean,
)

class Repository(private val context: Context, val session: Session, private val api: Api) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val flushLock = Mutex()
    private val queueFile = File(context.filesDir, "queue.json")
    private val pendingDir = File(context.filesDir, "pending")

    private val _orders = MutableStateFlow(readCache("orders", ListSerializer(WorkOrder.serializer())))
    val orders: StateFlow<List<WorkOrder>> = _orders.asStateFlow()

    private val _notifications = MutableStateFlow(readCache("notifications", ListSerializer(AppNotification.serializer())))
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    private val _pending = MutableStateFlow(loadQueue())
    val pending: StateFlow<List<PendingAction>> = _pending.asStateFlow()

    private val _online = MutableStateFlow(true)
    val online: StateFlow<Boolean> = _online.asStateFlow()

    private val _flushing = MutableStateFlow(false)
    val flushing: StateFlow<Boolean> = _flushing.asStateFlow()

    // Сообщения фоновой отправки (например, сервер отклонил сохранённое действие)
    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    init {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch { refreshAll() }
            }

            override fun onLost(network: Network) {
                _online.value = false
            }
        })
    }

    // ---------- Чтение ----------

    private val orderSelect =
        "*,equipment:equipment_id(id,name,inventory_no),section:section_id(id,name)," +
            "assignee:employees!work_orders_assignee_id_fkey(id,full_name)," +
            "master:employees!work_orders_master_id_fkey(id,full_name),fault:fault_code(code,name)"

    // Обновляет всё сразу: отправляет очередь, затем наряды и уведомления.
    // Возвращает ошибку, если не получилось загрузить наряды.
    suspend fun refreshAll(): Throwable? {
        if (!session.isLoggedIn) return null
        flush(notify = true)
        val error = refreshOrders()
        refreshNotifications()
        return error
    }

    suspend fun refreshOrders(): Throwable? = try {
        // Открытые наряды и закрытые за последние 7 дней — как на сайте
        val weekAgo = Instant.now().minus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS)
        val open = api.get("/rest/v1/work_orders?select=$orderSelect&status=not.in.(closed,cancelled)")
        val recent = api.get(
            "/rest/v1/work_orders?select=$orderSelect&status=in.(closed,cancelled)" +
                "&updated_at=gte.$weekAgo&order=updated_at.desc&limit=20",
        )
        val all = AppJson.decodeFromString<List<WorkOrder>>(open) + AppJson.decodeFromString<List<WorkOrder>>(recent)
        _orders.value = all
        session.putCache("orders", AppJson.encodeToString(ListSerializer(WorkOrder.serializer()), all))
        _online.value = true
        null
    } catch (e: IOException) {
        _online.value = false
        e
    } catch (e: ApiException) {
        e
    }

    suspend fun refreshNotifications() {
        try {
            val text = api.get(
                "/rest/v1/notifications?select=id,kind,text,order_id,read_at,created_at&order=created_at.desc&limit=50",
            )
            val list = AppJson.decodeFromString<List<AppNotification>>(text)
            _notifications.value = list
            session.putCache("notifications", AppJson.encodeToString(ListSerializer(AppNotification.serializer()), list))
        } catch (_: IOException) {
        } catch (_: ApiException) {
        }
    }

    // Полная карточка наряда. Без сети показываем строку из кэша списка.
    suspend fun loadDetail(orderId: String): Result<DetailData> = try {
        coroutineScope {
            val orderReq = async { api.get("/rest/v1/work_orders?id=eq.$orderId&select=$orderSelect") }
            val eventsReq = async {
                api.get(
                    "/rest/v1/work_order_events?order_id=eq.$orderId" +
                        "&select=id,action,reason,reason_code,comment,created_at,actor:actor_id(full_name)&order=created_at",
                )
            }
            val photosReq = async { api.get("/rest/v1/photos?order_id=eq.$orderId&select=id,kind,path,created_at&order=created_at") }
            val usageReq = async {
                api.get("/rest/v1/material_usages?order_id=eq.$orderId&select=id,qty,material:material_id(id,name,unit)")
            }
            val order = AppJson.decodeFromString<List<WorkOrder>>(orderReq.await()).firstOrNull()
                ?: throw ApiException(404, "not_found")
            val photos = AppJson.decodeFromString<List<Photo>>(photosReq.await())
            val views = photos.map { p -> async { PhotoView(p, api.signedPhotoUrl(p.path)) } }.awaitAll()
            _online.value = true
            Result.success(
                DetailData(
                    order = order,
                    events = AppJson.decodeFromString(eventsReq.await()),
                    photos = views,
                    materials = AppJson.decodeFromString(usageReq.await()),
                    fromCache = false,
                ),
            )
        }
    } catch (e: IOException) {
        _online.value = false
        val cached = _orders.value.firstOrNull { it.id == orderId }
        if (cached != null) Result.success(DetailData(cached, emptyList(), emptyList(), emptyList(), true)) else Result.failure(e)
    } catch (e: ApiException) {
        Result.failure(e)
    }

    // Справочники для формы закрытия. Без сети берём последние сохранённые.
    suspend fun faultCodes(): List<FaultCode> = loadRef("fault_codes", "/rest/v1/fault_codes?select=*&order=code", ListSerializer(FaultCode.serializer()))

    suspend fun materials(): List<Material> = loadRef("materials", "/rest/v1/materials?select=*&order=name", ListSerializer(Material.serializer()))

    private suspend fun <T> loadRef(key: String, path: String, serializer: kotlinx.serialization.KSerializer<List<T>>): List<T> =
        try {
            val text = api.get(path)
            session.putCache(key, text)
            AppJson.decodeFromString(serializer, text)
        } catch (_: Exception) {
            readCache(key, serializer)
        }

    private fun <T> readCache(key: String, serializer: kotlinx.serialization.KSerializer<List<T>>): List<T> =
        session.getCache(key)?.let { runCatching { AppJson.decodeFromString(serializer, it) }.getOrNull() } ?: emptyList()

    suspend fun markNotificationsRead(ids: List<String>?) {
        val now = Instant.now().toString()
        _notifications.value = _notifications.value.map {
            if ((ids == null || it.id in ids) && it.readAt == null) it.copy(readAt = now) else it
        }
        try {
            api.rpc(
                "mark_notifications_read",
                buildJsonObject {
                    put("p_ids", if (ids == null) JsonNull else JsonArray(ids.map { kotlinx.serialization.json.JsonPrimitive(it) }))
                },
            )
        } catch (_: Exception) {
            // Не получилось (нет сети): при следующем обновлении список придёт с сервера
        }
    }

    // ---------- Действия ----------

    suspend fun transition(order: WorkOrder, action: String, reason: String? = null, reasonCode: String? = null): ActionResult {
        val clientActionId = UUID.randomUUID().toString()
        val body = buildJsonObject {
            put("action", action)
            if (!reason.isNullOrBlank()) put("reason", reason.trim())
            if (!reasonCode.isNullOrBlank()) put("reasonCode", reasonCode)
            put("clientActionId", clientActionId)
        }
        return submit(PendingAction(clientActionId, "transition", order.id, order.number, body.toString()))
    }

    suspend fun complete(
        order: WorkOrder,
        workDone: String,
        faultCode: String?,
        materials: List<SelectedMaterial>,
        photoUris: List<Uri>,
    ): ActionResult {
        val clientActionId = UUID.randomUUID().toString()
        // Фото сначала сжимаем и кладём в файлы: так они переживут обрыв сети и перезапуск приложения
        val photos = withContext(Dispatchers.IO) {
            photoUris.map { uri ->
                val name = "${UUID.randomUUID()}.jpg"
                ImageUtils.compressToFile(context, uri, File(pendingDir, name))
                PendingPhoto(file = name, storagePath = "${order.id}/after-${UUID.randomUUID()}.jpg", kind = "after")
            }
        }
        val body = buildJsonObject {
            put("workDone", workDone.trim())
            if (!faultCode.isNullOrBlank()) put("faultCode", faultCode)
            put(
                "materials",
                buildJsonArray {
                    materials.forEach {
                        add(buildJsonObject { put("materialId", it.materialId); put("qty", it.qty) })
                    }
                },
            )
            put("clientActionId", clientActionId)
        }
        return submit(PendingAction(clientActionId, "complete", order.id, order.number, body.toString(), photos))
    }

    // Кладёт действие в очередь и сразу пробует отправить. Очередь хранится на телефоне,
    // clientActionId не меняется при повторах, поэтому сервер не задублирует действие.
    private suspend fun submit(action: PendingAction): ActionResult {
        setPending(_pending.value + action)
        val outcomes = flush(notify = false)
        return outcomes[action.id] ?: ActionResult.Queued
    }

    // Отправляет сохранённые действия по порядку. Нет сети — оставляет всё в очереди до следующего раза.
    suspend fun flush(notify: Boolean): Map<String, ActionResult> {
        if (!session.isLoggedIn || _pending.value.isEmpty()) return emptyMap()
        val outcomes = mutableMapOf<String, ActionResult>()
        flushLock.withLock {
            _flushing.value = true
            try {
                for (action in _pending.value.toList()) {
                    try {
                        send(action)
                        setPending(_pending.value.filterNot { it.id == action.id })
                        deleteFiles(action)
                        outcomes[action.id] = ActionResult.Sent
                    } catch (e: IOException) {
                        _online.value = false
                        outcomes[action.id] = ActionResult.Queued
                        break
                    } catch (e: ApiException) {
                        if (e.status == 401 || e.status >= 500) {
                            // Сессия или сервер временно недоступны: оставляем в очереди
                            outcomes[action.id] = ActionResult.Queued
                            break
                        }
                        // Сервер отказал: повтор не поможет, убираем и показываем текст как есть
                        setPending(_pending.value.filterNot { it.id == action.id })
                        deleteFiles(action)
                        outcomes[action.id] = ActionResult.Failed(e.message ?: "")
                        if (notify) _messages.tryEmit("№${action.number}: ${e.message}")
                    }
                }
            } finally {
                _flushing.value = false
            }
        }
        if (outcomes.values.any { it is ActionResult.Sent }) {
            _online.value = true
            refreshOrders()
            refreshNotifications()
        }
        return outcomes
    }

    private suspend fun send(action: PendingAction) {
        var photos = action.photos
        for (i in photos.indices) {
            var photo = photos[i]
            if (!photo.uploaded) {
                val bytes = withContext(Dispatchers.IO) { File(pendingDir, photo.file).readBytes() }
                api.uploadPhoto(photo.storagePath, bytes)
                photo = photo.copy(uploaded = true)
                photos = photos.toMutableList().also { it[i] = photo }
                savePhotos(action.id, photos)
            }
            if (!photo.registered) {
                api.postRoute(
                    "/api/mobile/orders/${action.orderId}/photos",
                    buildJsonObject { put("kind", photo.kind); put("path", photo.storagePath) }.toString(),
                )
                photo = photo.copy(registered = true)
                photos = photos.toMutableList().also { it[i] = photo }
                savePhotos(action.id, photos)
            }
        }
        val route = if (action.type == "complete") "complete" else "transition"
        api.postRoute("/api/mobile/orders/${action.orderId}/$route", action.bodyJson)
    }

    // ---------- Очередь на диске ----------

    private fun savePhotos(actionId: String, photos: List<PendingPhoto>) =
        setPending(_pending.value.map { if (it.id == actionId) it.copy(photos = photos) else it })

    private fun setPending(list: List<PendingAction>) {
        _pending.value = list
        queueFile.writeText(AppJson.encodeToString(ListSerializer(PendingAction.serializer()), list))
    }

    private fun loadQueue(): List<PendingAction> = runCatching {
        if (queueFile.exists()) AppJson.decodeFromString(ListSerializer(PendingAction.serializer()), queueFile.readText()) else emptyList()
    }.getOrDefault(emptyList())

    private fun deleteFiles(action: PendingAction) =
        action.photos.forEach { File(pendingDir, it.file).delete() }

    fun pendingFor(orderId: String): Int = _pending.value.count { it.orderId == orderId }

    // Выход из аккаунта
    suspend fun logout() {
        api.logout()
        _orders.value = emptyList()
        _notifications.value = emptyList()
    }

    suspend fun login(login: String, password: String): Employee {
        val employee = api.login(login, password)
        if (employee.role != "worker") {
            api.logout()
            throw NotWorkerException()
        }
        session.saveEmployee(employee)
        scope.launch { refreshAll() }
        return employee
    }
}
