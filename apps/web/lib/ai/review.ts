import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee } from "@/lib/notify";
import { reviewReadyText } from "@/lib/notify/messages";
import type { Json } from "@/lib/supabase/database.types";
import { createAnonymizer } from "./anonymize";
import type { ReviewChecks } from "./types";
import { chatJson, type AiProvider, type ContentPart } from "./provider";
import { PHOTO_CHECK_SYSTEM, REVIEW_TEXT_SYSTEM, WORK_MATCH_SYSTEM } from "./prompts";
import { runRules, rulesScore, type RuleCheck } from "./rules";
import {
  validatePhotoCheck,
  validateReviewText,
  validateWorkMatch,
  type PhotoCheck,
  type ReviewText,
  type WorkMatch,
} from "./schemas";

// ИИ-проверка закрытого наряда (п. 6.2–6.4 кейса). Запускается после «Исполнено».
//
// 1. Код: полнота, материалы, время, повтор фото (rules.ts).
// 2. Модель по тексту: устраняют ли работы описанную проблему.
// 3. Модель по фото: «до» и «после», качество.
// 4. Код сводит всё в вердикт и оценку. Модель только пишет пояснение для людей.
// Наряд остаётся в статусе «Проверка ИИ»: закрывает или возвращает его мастер.

export type Verdict = "accept" | "accept_with_note" | "rework" | "needs_master";

const EXCUSED_PAUSES = ["waiting_parts", "waiting_permit", "waiting_stop"];
const MAX_PHOTOS_PER_KIND = 2; // больше двух фото на вид модели не отправляем: дольше и дороже

export async function reviewOrder(orderId: string): Promise<{ verdict: Verdict } | null> {
  const db = createAdminClient();

  const { data: order } = await db
    .from("work_orders")
    .select("*, fault:fault_code ( code, name, norm_hours ), equipment:equipment_id ( name, type )")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "ai_review") return null;

  // Повторный запуск (например, после сбоя) не создаёт вторую проверку за то же закрытие.
  const { data: existing } = await db
    .from("ai_reviews")
    .select("id, verdict, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && order.done_at && existing.created_at > order.done_at) return { verdict: existing.verdict };

  const [settingsRes, employeesRes, materialsRes, photosRes, eventsRes] = await Promise.all([
    db.from("settings").select("ai_provider, ai_confidence_threshold").eq("id", 1).single(),
    db.from("employees").select("full_name"),
    db
      .from("material_usages")
      .select("qty, material:material_id ( name, unit, typical_qty, fault_codes )")
      .eq("order_id", orderId),
    db.from("photos").select("kind, path, sha256").eq("order_id", orderId).order("created_at"),
    db.from("work_order_events").select("action, reason_code, created_at").eq("order_id", orderId).order("created_at"),
  ]);

  const provider = (settingsRes.data?.ai_provider ?? process.env.AI_PROVIDER ?? "cloud") as AiProvider;
  const threshold = settingsRes.data?.ai_confidence_threshold ?? 0.6;
  const anon = createAnonymizer((employeesRes.data ?? []).map((e) => e.full_name));
  const photos = photosRes.data ?? [];
  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");

  // Повтор фото: тот же отпечаток уже есть в другом наряде.
  const afterHashes = after.map((p) => p.sha256).filter((h): h is string => !!h);
  const { count: duplicates } = afterHashes.length
    ? await db.from("photos").select("id", { count: "exact", head: true }).in("sha256", afterHashes).neq("order_id", orderId)
    : { count: 0 };

  // ---------- 1. Правила ----------
  const rules = runRules({
    type: order.type,
    workDone: order.work_done,
    faultCode: order.fault_code,
    normHours: order.fault?.norm_hours ?? null,
    startedAt: order.started_at,
    doneAt: order.done_at,
    dueAt: order.due_at,
    excusedPauseMinutes: excusedPauseMinutes(eventsRes.data ?? []),
    afterPhotos: after.length,
    duplicatePhotos: duplicates ?? 0,
    materials: (materialsRes.data ?? []).flatMap((m) =>
      m.material
        ? [{ name: m.material.name, unit: m.material.unit, qty: m.qty, typicalQty: m.material.typical_qty, faultCodes: m.material.fault_codes }]
        : [],
    ),
  });

  const errors: string[] = [];

  // ---------- 2. Работы против проблемы (текст) ----------
  let workMatch: WorkMatch | null = null;
  if (order.work_done) {
    const res = await chatJson({
      provider,
      system: WORK_MATCH_SYSTEM,
      user: anon.hide(
        `Оборудование: ${order.equipment?.name ?? "—"} (${order.equipment?.type ?? "—"}).\n` +
          `Проблема: ${order.description}\n` +
          `Шифр неисправности: ${order.fault ? `${order.fault.code} ${order.fault.name}` : "не указан"}\n` +
          `Выполненные работы: ${order.work_done}\n` +
          `Комментарий исполнителя: ${order.close_comment ?? "—"}`,
      ),
      validate: validateWorkMatch,
      timeoutMs: 20000,
    });
    if (res.ok) workMatch = { ...res.data, explanation: anon.restore(res.data.explanation) };
    else errors.push(`work_match: ${res.error}`);
  }

  // ---------- 3. Фото ----------
  let photoCheck: PhotoCheck | null = null;
  if (after.length > 0) {
    const images = await loadImages([...before.slice(0, MAX_PHOTOS_PER_KIND), ...after.slice(0, MAX_PHOTOS_PER_KIND)]);
    const beforeCount = Math.min(before.length, MAX_PHOTOS_PER_KIND);
    const content: ContentPart[] = [
      {
        type: "text",
        text: anon.hide(
          `Оборудование: ${order.equipment?.name ?? "—"}. Проблема: ${order.description}. ` +
            `Работы: ${order.work_done ?? "—"}. Фото «до»: ${beforeCount}, фото «после»: ${images.length - beforeCount}.`,
        ),
      },
      ...images.map((url): ContentPart => ({ type: "image_url", image_url: { url } })),
    ];
    const res = await chatJson({
      provider,
      system: PHOTO_CHECK_SYSTEM,
      user: content,
      validate: validatePhotoCheck,
      withImages: true,
      timeoutMs: 45000,
    });
    if (res.ok) photoCheck = res.data;
    else errors.push(`photo: ${res.error}`);
  }

  // ---------- 4. Вердикт: решает код ----------
  const { verdict, score, confidence } = decide({ rules, workMatch, photoCheck, threshold, hadAiError: errors.length > 0 });
  const source = photoCheck ? "vlm" : workMatch ? "llm" : "rules";

  // ---------- 5. Пояснение для людей ----------
  let text: ReviewText | null = null;
  const facts = {
    verdict,
    score,
    rules: rules.map((r) => ({ status: r.status, message: r.message })),
    work_match: workMatch,
    photo: photoCheck && {
      repair_visible: photoCheck.repair_visible,
      quality_findings: photoCheck.quality_findings,
      cannot_verify: photoCheck.cannot_verify,
    },
  };
  const textRes = await chatJson({
    provider,
    system: REVIEW_TEXT_SYSTEM,
    user: anon.hide(JSON.stringify(facts)),
    validate: validateReviewText,
    timeoutMs: 20000,
  });
  if (textRes.ok) {
    text = {
      good: textRes.data.good.map(anon.restore),
      improve: textRes.data.improve.map(anon.restore),
      summary: anon.restore(textRes.data.summary),
    };
  } else {
    errors.push(`text: ${textRes.error}`);
    text = fallbackText(rules);
  }

  // ---------- 6. Сохранить, записать в журнал, уведомить ----------
  const reviewChecks: ReviewChecks = { rules, work_match: workMatch, photo: photoCheck, text, provider, errors };
  const checks = reviewChecks as unknown as Json;
  await db.from("ai_reviews").insert({
    order_id: orderId,
    verdict,
    score,
    confidence,
    checks,
    explanation: text.summary,
    source,
  });
  await db.from("work_order_events").insert({
    order_id: orderId,
    actor_id: null,
    action: "ai_verdict",
    from_status: "ai_review",
    to_status: "ai_review",
    comment: `${verdict}, ${score}/5`,
  });

  const message = reviewReadyText({ number: order.number, verdict, score, summary: text.summary });
  const recipients = [order.assignee_id, order.master_id].filter((id): id is string => !!id);
  await Promise.all(recipients.map((employeeId) => notifyEmployee({ employeeId, kind: "review_ready", text: message, orderId })));

  return { verdict };
}

// Сведение результатов в один вердикт. Порядок важен: сначала то, что точно плохо.
export function decide(input: {
  rules: RuleCheck[];
  workMatch: WorkMatch | null;
  photoCheck: PhotoCheck | null;
  threshold: number;
  hadAiError: boolean;
}): { verdict: Verdict; score: number; confidence: number } {
  const { rules, workMatch, photoCheck, threshold } = input;
  const fails = rules.filter((r) => r.status === "fail").length;
  const warns = rules.filter((r) => r.status === "warn").length;

  const ruleScore = rulesScore(rules);
  const score = photoCheck ? Math.round((ruleScore + photoCheck.score) / 2) : ruleScore;
  const aiConfidences = [workMatch?.confidence, photoCheck?.confidence].filter((c): c is number => c !== undefined);
  const confidence = aiConfidences.length ? Math.min(...aiConfidences) : 1;

  // Явная ошибка по правилам или уверенное «работы не про это» / «не исправлено» — на доработку.
  if (fails > 0) return { verdict: "rework", score: Math.min(score, 2), confidence: 1 };
  if (workMatch && !workMatch.matches && workMatch.confidence >= threshold) return { verdict: "rework", score: Math.min(score, 2), confidence };
  if (photoCheck?.verdict === "rework" && photoCheck.confidence >= threshold) return { verdict: "rework", score: Math.min(score, 2), confidence };

  // Модель недоступна или не уверена — решение за мастером, оценку не выдумываем.
  if (input.hadAiError || confidence < threshold || photoCheck?.verdict === "needs_master") {
    return { verdict: "needs_master", score, confidence };
  }

  if (warns > 0 || photoCheck?.verdict === "accept_with_note" || (photoCheck?.quality_findings.length ?? 0) > 0) {
    return { verdict: "accept_with_note", score: Math.min(score, 4), confidence };
  }
  return { verdict: "accept", score, confidence };
}

// Минуты пауз по уважительным причинам: от «пауза» до следующего «продолжить» или «исполнено».
function excusedPauseMinutes(events: { action: string; reason_code: string | null; created_at: string }[]): number {
  let total = 0;
  let pausedAt: number | null = null;
  for (const e of events) {
    const time = new Date(e.created_at).getTime();
    if (e.action === "pause" && e.reason_code && EXCUSED_PAUSES.includes(e.reason_code)) pausedAt = time;
    else if (pausedAt !== null && (e.action === "resume" || e.action === "done")) {
      total += (time - pausedAt) / 60000;
      pausedAt = null;
    }
  }
  return total;
}

// Фото из закрытого хранилища в виде data URL для модели.
async function loadImages(photos: { path: string }[]): Promise<string[]> {
  const db = createAdminClient();
  const urls: string[] = [];
  for (const p of photos) {
    const { data } = await db.storage.from("photos").download(p.path);
    if (!data) continue;
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    urls.push(`data:image/jpeg;base64,${base64}`);
  }
  return urls;
}

// Пояснение без модели: из проверок кода.
function fallbackText(rules: RuleCheck[]): ReviewText {
  return {
    good: rules.filter((r) => r.status === "ok").map((r) => r.message),
    improve: rules.filter((r) => r.status !== "ok").map((r) => r.message),
    summary: rules.filter((r) => r.status !== "ok").map((r) => r.message).join(" ") || rules[0]?.message || "",
  };
}
