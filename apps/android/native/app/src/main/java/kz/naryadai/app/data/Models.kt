// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Модели только описывают строки из базы. Логики в них нет.

@Serializable
data class Named(
    val id: String? = null,
    val name: String = "",
    @SerialName("inventory_no") val inventoryNo: String? = null,
)

@Serializable
data class PersonRef(
    val id: String? = null,
    @SerialName("full_name") val fullName: String = "",
    val specialty: String? = null,
)

@Serializable
data class FaultRef(val code: String = "", val name: String = "")

@Serializable
data class WorkOrder(
    val id: String,
    val number: Int,
    val type: String = "planned",
    val description: String = "",
    val priority: String = "normal",
    val status: String = "issued",
    @SerialName("due_at") val dueAt: String = "",
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("needs_permit") val needsPermit: Boolean = false,
    @SerialName("fault_code") val faultCode: String? = null,
    @SerialName("work_done") val workDone: String? = null,
    val equipment: Named? = null,
    val section: Named? = null,
    val assignee: PersonRef? = null,
    val master: PersonRef? = null,
    val fault: FaultRef? = null,
)

@Serializable
data class OrderEvent(
    val id: String,
    val action: String,
    val reason: String? = null,
    @SerialName("reason_code") val reasonCode: String? = null,
    val comment: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    val actor: PersonRef? = null,
)

@Serializable
data class Photo(
    val id: String,
    val kind: String,
    val path: String,
    @SerialName("created_at") val createdAt: String = "",
)

// Фото вместе с временной ссылкой на просмотр (bucket закрытый)
data class PhotoView(val photo: Photo, val url: String?)

@Serializable
data class MaterialRef(val id: String? = null, val name: String = "", val unit: String = "")

@Serializable
data class MaterialUsage(val id: String, val qty: Double = 0.0, val material: MaterialRef? = null)

@Serializable
data class AppNotification(
    val id: String,
    val kind: String = "",
    val text: String = "",
    @SerialName("order_id") val orderId: String? = null,
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class FaultCode(
    val code: String,
    val category: String = "",
    val name: String = "",
    @SerialName("norm_hours") val normHours: Double = 0.0,
)

@Serializable
data class Material(
    val id: String,
    val name: String,
    val unit: String = "",
    @SerialName("typical_qty") val typicalQty: Double = 1.0,
    @SerialName("fault_codes") val faultCodes: List<String> = emptyList(),
)

@Serializable
data class Employee(
    val id: String,
    @SerialName("full_name") val fullName: String,
    val role: String,
    val login: String? = null,
)

// Один выбранный материал в форме закрытия
@Serializable
data class SelectedMaterial(val materialId: String, val name: String, val unit: String, val qty: Double)

// --- Очередь действий без сети -------------------------------------------------

@Serializable
data class PendingPhoto(
    val file: String, // имя файла в filesDir/pending
    val storagePath: String, // путь в bucket photos: {orderId}/{kind}-{uuid}.jpg
    val kind: String,
    val uploaded: Boolean = false,
    val registered: Boolean = false,
)

// id — это clientActionId: создаётся один раз на нажатие и при повторе не меняется.
@Serializable
data class PendingAction(
    val id: String,
    val type: String, // "transition" или "complete"
    val orderId: String,
    val number: Int,
    val bodyJson: String,
    val photos: List<PendingPhoto> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
)

sealed interface ActionResult {
    data object Sent : ActionResult
    data object Queued : ActionResult
    data class Failed(val message: String) : ActionResult
}
