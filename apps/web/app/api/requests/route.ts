import { NextResponse } from "next/server";
import { after } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { notifyNewRequest } from "@/lib/requests/notify";
import { cleanCode } from "@/lib/requests/lookup";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n-server";

// Заявка оператора о поломке (PLAN.md, раздел 4: «Оператор без входа»).
// Анониму в базу напрямую писать нельзя: заявку принимает этот маршрут и вызывает
// submit_operator_request служебным ключом. Функция проверяет настоящий QR,
// обязательное ФИО без входа и ограничение частоты (5 заявок с телефона за 10 минут).

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const t = await getT();
  const form = await request.formData().catch(() => null);
  if (!form) return error(t("report.errors.bad"));

  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v.trim() : "";
  };
  const code = cleanCode(text("code"));
  const deviceId = text("deviceId").slice(0, 64);
  const equipmentId = text("equipmentId") || null;
  if (equipmentId && !/^[0-9a-f-]{36}$/i.test(equipmentId)) return error(t("report.errors.bad"));

  // Вошедший оператор — автор заявки, его ФИО уже известно.
  const employee = await getCurrentEmployee();
  const author = employee?.role === "operator" ? employee.id : null;

  const db = createAdminClient();

  // Фото уже сжато на телефоне (canvas убирает метаданные). Кладём в закрытое хранилище.
  let photoPath: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES || !photo.type.startsWith("image/")) return error(t("report.errors.photo"));
    photoPath = `requests/${crypto.randomUUID()}.jpg`;
    const upload = await db.storage.from("photos").upload(photoPath, photo, { contentType: "image/jpeg" });
    if (upload.error) photoPath = null; // без фото заявка всё равно важнее
  }

  const { data, error: dbError } = await db.rpc("submit_operator_request", {
    p_code: code,
    p_description: text("description").slice(0, 1000),
    p_machine_state: text("machineState"),
    p_reporter_name: author ? (employee?.fullName ?? "") : text("reporterName").slice(0, 120),
    p_device_id: deviceId,
    p_author: author ?? undefined,
    p_equipment_id: equipmentId ?? undefined,
    p_photo_path: photoPath ?? undefined,
  });
  if (dbError) {
    // 22023 и P0002 — наши проверки, их текст написан для человека.
    const known = dbError.code === "22023" || dbError.code === "P0002";
    return error(known ? dbError.message : t("report.errors.save"), known ? 400 : 500);
  }
  const created = data?.[0];
  if (!created) return error(t("report.errors.save"), 500);

  // Мастерам сообщаем после ответа: оператор не ждёт Telegram.
  after(() => notifyNewRequest(created.id));
  return NextResponse.json({ ok: true, id: created.id, number: created.number });
}

// «Мои заявки» оператора без входа: по случайному номеру телефона из localStorage.
export async function GET(request: Request) {
  const t = await getT();
  const deviceId = new URL(request.url).searchParams.get("device") ?? "";
  if (deviceId.length < 8) return NextResponse.json({ ok: true, items: [] });
  const db = createAdminClient();
  const { data, error: dbError } = await db.rpc("operator_requests_by_device", { p_device_id: deviceId.slice(0, 64) });
  if (dbError) return error(t("report.errors.load"), 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}
