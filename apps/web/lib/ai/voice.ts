// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import { createAnonymizer } from "./anonymize";
import { chatJson } from "./provider";

// Голос в два шага (PLAN.md, раздел 4):
// 1. Речь → текст: Whisper large-v3-turbo на нашем Mac (services/fast-ai, POST /transcribe).
// 2. Текст → поля наряда: Qwen3-4B на Mac через Ollama; Mac молчит — облако с обезличиванием;
//    облако недоступно — текст без разбора. Человек всегда проверяет поля перед выдачей.
// Машина и исполнитель из ответа модели сверяются со справочником кодом: нет совпадения — поле пустое.

const TRANSCRIBE_TIMEOUT_MS = 25000;
const PARSE_TIMEOUT_MS = 15000;
const PRIORITIES = ["emergency", "high", "normal", "planned"] as const;
export type SpeechPriority = (typeof PRIORITIES)[number];

export type Transcript = { text: string; source: "whisper" };

export async function transcribeAudio(audio: Blob, lang: string): Promise<Transcript | null> {
  const url = process.env.FAST_AI_URL;
  if (!url) return null;
  const form = new FormData();
  form.set("audio", audio, "speech.webm");
  form.set("lang", lang.startsWith("kk") ? "kk" : "ru");
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.FAST_AI_SECRET ?? ""}` },
      body: form,
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    return text ? { text, source: "whisper" } : null;
  } catch {
    return null; // Mac выключен или туннель не отвечает — в браузере остаётся распознавание телефона
  }
}

export type SpeechRefs = {
  equipment: { id: string; name: string; inventory_no: string }[];
  workers: { id: string; full_name: string }[];
  faultCodes: { code: string; name: string }[];
};

export type SpeechFields = {
  problem: string | null;
  equipmentId: string | null;
  priority: SpeechPriority | null;
  faultCode: string | null;
  assigneeId: string | null;
  confidence: number;
  source: "llm" | "rules";
};

type RawFields = {
  equipment_hint: string | null;
  problem: string | null;
  priority: SpeechPriority | null;
  fault_code: string | null;
  assignee_hint: string | null;
  confidence: number;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function validate(v: unknown): RawFields | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const priority = (PRIORITIES as readonly unknown[]).includes(o.priority) ? (o.priority as SpeechPriority) : null;
  const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0.5;
  return {
    equipment_hint: str(o.equipment_hint),
    problem: str(o.problem),
    priority,
    fault_code: str(o.fault_code),
    assignee_hint: str(o.assignee_hint),
    confidence,
  };
}

// «НШ-2», «нш 2», «насос нш2» → нормализованная строка без пробелов и дефисов.
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[\s\-–«»"]/g, "");

function matchEquipment(hint: string | null, list: SpeechRefs["equipment"]): string | null {
  if (!hint) return null;
  const h = norm(hint);
  const exact = list.find((e) => norm(e.name) === h || norm(e.inventory_no) === h);
  if (exact) return exact.id;
  // Короткий код вроде «нш2» внутри названия «Насос шламовый НШ-2». Совпало несколько — не угадываем.
  if (h.length < 3) return null;
  const byPart = list.filter((e) => norm(e.name).includes(h));
  return byPart.length === 1 ? byPart[0].id : null;
}

function matchWorker(hint: string | null, list: SpeechRefs["workers"]): string | null {
  if (!hint) return null;
  // Фамилию часто говорят в дательном падеже: «Ахметову» → ищем по первым 5 буквам.
  const h = norm(hint).slice(0, 5);
  if (h.length < 3) return null;
  const found = list.filter((w) => norm(w.full_name.split(" ")[0]).startsWith(h));
  return found.length === 1 ? found[0].id : null;
}

function systemPrompt(refs: SpeechRefs): string {
  const codes = refs.faultCodes.map((c) => `${c.code} ${c.name}`).join("; ");
  return (
    `Мастер ремонтной службы надиктовал наряд. Разложи разговорный текст по полям.\n` +
    `Шифры неисправностей: ${codes}.\n` +
    `priority: emergency — авария, оборудование стоит или опасно; high — срочно; normal — обычный ремонт; planned — плановые работы.\n` +
    `equipment_hint — как названо оборудование (например «НШ-2»), assignee_hint — фамилия исполнителя, как сказано.\n` +
    `Не выдумывай: чего нет в тексте — null.\n` +
    `Ответ строго JSON: {"equipment_hint": "...|null", "problem": "кратко что сломано", "priority": "...|null", ` +
    `"fault_code": "код из списка|null", "assignee_hint": "...|null", "confidence": 0..1}`
  );
}

export async function parseOrderSpeech(text: string, refs: SpeechRefs): Promise<SpeechFields> {
  const empty: SpeechFields = { problem: null, equipmentId: null, priority: null, faultCode: null, assigneeId: null, confidence: 0, source: "rules" };
  if (text.trim().length < 3) return empty;
  const system = systemPrompt(refs);

  // 1. Наш Mac: Qwen3-4B через Ollama. Данные не уходят наружу, обезличивать не нужно.
  let raw: RawFields | null = null;
  if (process.env.OLLAMA_URL) {
    const local = await chatJson({
      provider: "local",
      model: process.env.OLLAMA_VOICE_MODEL ?? "qwen3:4b-instruct-2507-q4_K_M",
      system,
      user: text,
      validate,
      timeoutMs: PARSE_TIMEOUT_MS,
      maxTokens: 400,
    });
    if (local.ok) raw = local.data;
  }

  // 2. Облако: фамилии заменяются метками до отправки и возвращаются после ответа.
  if (!raw) {
    const anon = createAnonymizer(refs.workers.map((w) => w.full_name));
    const cloud = await chatJson({
      provider: "cloud",
      system,
      user: anon.hide(text),
      validate,
      timeoutMs: PARSE_TIMEOUT_MS,
      maxTokens: 600,
    });
    if (cloud.ok) {
      raw = {
        ...cloud.data,
        problem: cloud.data.problem ? anon.restore(cloud.data.problem) : null,
        assignee_hint: cloud.data.assignee_hint ? anon.restore(cloud.data.assignee_hint) : null,
      };
    }
  }

  // 3. Модели недоступны — поля не заполняем, текст пойдёт в описание как есть.
  if (!raw) return { ...empty, problem: text.trim() };

  return {
    problem: raw.problem ?? text.trim(),
    equipmentId: matchEquipment(raw.equipment_hint, refs.equipment),
    priority: raw.priority,
    faultCode: refs.faultCodes.some((c) => c.code === raw.fault_code) ? raw.fault_code : null,
    assigneeId: matchWorker(raw.assignee_hint, refs.workers),
    confidence: raw.confidence,
    source: "llm",
  };
}
