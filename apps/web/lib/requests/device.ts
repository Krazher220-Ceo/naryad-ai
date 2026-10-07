// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

// Что оператор без входа хранит на своём телефоне (localStorage):
// - device id: случайный номер телефона, по нему открываются «Мои заявки»;
// - ФИО: подставляется в каждую заявку;
// - очередь заявок, отправленных без сети. Фото в очередь не попадает: оно слишком большое для хранилища.

const DEVICE_KEY = "naryad-device-id";
const NAME_KEY = "naryad-reporter-name";
const QUEUE_KEY = "naryad-request-queue";
export const REQUEST_QUEUE_EVENT = "naryad-request-queue-changed";

export type PendingRequest = {
  localId: string;
  code: string;
  equipmentId: string | null;
  place: string;
  description: string;
  machineState: string;
  reporterName: string;
  savedAt: string;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Хранилище недоступно (приватный режим): работаем без него.
  }
}

export function getDeviceId(): string {
  let id = read<string | null>(DEVICE_KEY, null);
  if (!id) {
    id = crypto.randomUUID();
    write(DEVICE_KEY, id);
  }
  return id;
}

export function getReporterName(): string {
  return read<string>(NAME_KEY, "");
}

export function setReporterName(name: string) {
  write(NAME_KEY, name.trim());
}

export function pendingRequests(): PendingRequest[] {
  return read<PendingRequest[]>(QUEUE_KEY, []);
}

function setQueue(queue: PendingRequest[]) {
  write(QUEUE_KEY, queue);
  window.dispatchEvent(new Event(REQUEST_QUEUE_EVENT));
}

export type SendRequestResult =
  | { ok: true; number: number }
  | { ok: true; queued: true }
  | { ok: false; error: string };

function toForm(r: Omit<PendingRequest, "localId" | "savedAt" | "place">, photo?: Blob | null): FormData {
  const form = new FormData();
  form.set("code", r.code);
  if (r.equipmentId) form.set("equipmentId", r.equipmentId);
  form.set("description", r.description);
  form.set("machineState", r.machineState);
  form.set("reporterName", r.reporterName);
  form.set("deviceId", getDeviceId());
  if (photo) form.set("photo", photo, "photo.jpg");
  return form;
}

// Отправить заявку. Нет сети — положить в очередь и вернуть queued.
export async function sendRequest(
  r: Omit<PendingRequest, "localId" | "savedAt">,
  photo?: Blob | null,
): Promise<SendRequestResult> {
  const enqueue = (): SendRequestResult => {
    setQueue([...pendingRequests(), { ...r, localId: crypto.randomUUID(), savedAt: new Date().toISOString() }]);
    return { ok: true, queued: true };
  };
  if (!navigator.onLine) return enqueue();
  try {
    const res = await fetch("/api/requests", { method: "POST", body: toForm(r, photo) });
    const body = (await res.json()) as { ok: boolean; number?: number; error?: string };
    if (body.ok && body.number) return { ok: true, number: body.number };
    return { ok: false, error: body.error ?? "" };
  } catch {
    return enqueue();
  }
}

// Отправить сохранённые без сети заявки по порядку. Сеть снова пропала — остаток ждёт.
export async function flushRequests(): Promise<{ sent: number; failed: string[] }> {
  let sent = 0;
  const failed: string[] = [];
  for (const item of pendingRequests()) {
    let body: { ok: boolean; error?: string };
    try {
      const res = await fetch("/api/requests", { method: "POST", body: toForm(item) });
      body = (await res.json()) as { ok: boolean; error?: string };
    } catch {
      break;
    }
    if (body.ok) sent++;
    else failed.push(body.error ?? "");
    setQueue(pendingRequests().filter((q) => q.localId !== item.localId));
  }
  return { sent, failed };
}
