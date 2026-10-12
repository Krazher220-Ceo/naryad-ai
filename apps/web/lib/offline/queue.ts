// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import {
  completeOrder,
  createOrder,
  createSideRequest,
  transitionOrder,
  type CompleteOrderInput,
  type CreateOrderInput,
  type TransitionInput,
} from "@/lib/orders/actions";
import { uploadOrderPhoto } from "@/lib/orders/photos";
import { deletePhoto, loadPhoto, savePhotos } from "./photo-store";

// Офлайн-очередь действий (п. 5.3.5 кейса: «действия сохраняются на телефоне
// и отправляются при появлении сети»).
//
// Как работает:
// 1. send* пробует отправить действие сразу.
// 2. Нет сети (браузер офлайн или запрос не дошёл) — действие кладётся в localStorage,
//    а фото к нему — в IndexedDB (photo-store.ts).
// 3. flushQueue при появлении сети отправляет сохранённое по порядку.
// Дублей нарядов и переходов не бывает: у действия свой clientActionId, и база не выполняет
// действие с уже известным id второй раз (функции 0003_order_functions.sql).

const KEY = "naryad-offline-queue";
export const QUEUE_EVENT = "naryad-queue-changed";

type Base = { id: string; queuedAt: string };
export type QueuedAction =
  | (Base & { kind: "transition"; input: TransitionInput })
  | (Base & { kind: "createOrder"; input: CreateOrderInput; photoIds: string[]; authorId: string })
  | (Base & { kind: "complete"; input: CompleteOrderInput; photoIds: string[]; authorId: string })
  | (Base & { kind: "sideRequest"; input: { orderId: string; equipmentId: string; description: string } });

// То же действие, но без id и времени: их ставит enqueue.
type NewAction = QueuedAction extends infer A ? (A extends QueuedAction ? Omit<A, "id" | "queuedAt"> : never) : never;

export type SendResult = { ok: true; queued: boolean } | { ok: false; error: string };

function read(): QueuedAction[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as { kind?: string; input: { clientActionId?: string } }[];
    // Записи из прошлой версии очереди были без kind и id: это переходы статуса.
    return raw.map((q) => (q.kind ? q : { ...q, kind: "transition", id: q.input.clientActionId }) as unknown as QueuedAction);
  } catch {
    return [];
  }
}

function write(queue: QueuedAction[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Хранилище недоступно (приватный режим) — очередь просто не сохранится.
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function pendingActions(): QueuedAction[] {
  return read();
}

function enqueue(action: NewAction) {
  write([...read(), { ...action, id: crypto.randomUUID(), queuedAt: new Date().toISOString() } as QueuedAction]);
}

// Общая схема для всех действий: нет сети — сразу в очередь; запрос не дошёл — тоже в очередь.
// Ответ сервера с ошибкой (нет прав, наряд отменён) в очередь не кладём, а показываем человеку.
async function sendOrQueue(attempt: () => Promise<{ ok: boolean; error?: string }>, queue: () => Promise<void>): Promise<SendResult> {
  if (!navigator.onLine) {
    await queue();
    return { ok: true, queued: true };
  }
  try {
    const res = await attempt();
    return res.ok ? { ok: true, queued: false } : { ok: false, error: res.error ?? "" };
  } catch {
    await queue();
    return { ok: true, queued: true };
  }
}

export function sendTransition(input: TransitionInput): Promise<SendResult> {
  return sendOrQueue(
    () => transitionOrder(input),
    async () => enqueue({ kind: "transition", input }),
  );
}

// Выдача наряда мастером. Фото «до» уходят после того, как база вернула id наряда.
export function sendCreateOrder(input: CreateOrderInput, photos: File[], authorId: string): Promise<SendResult> {
  return sendOrQueue(
    async () => {
      const res = await createOrder(input);
      if (res.ok) await uploadPhotos(res.data.orderId, "before", photos, authorId);
      return res;
    },
    async () => enqueue({ kind: "createOrder", input, photoIds: await savePhotos(photos), authorId }),
  );
}

// Закрытие наряда исполнителем: сначала фото «после», потом само действие (так требует база).
export function sendComplete(input: CompleteOrderInput, photos: File[], authorId: string): Promise<SendResult> {
  return sendOrQueue(
    async () => {
      await uploadPhotos(input.orderId, "after", photos, authorId);
      return completeOrder(input);
    },
    async () => enqueue({ kind: "complete", input, photoIds: await savePhotos(photos), authorId }),
  );
}

export function sendSideRequest(input: { orderId: string; equipmentId: string; description: string }): Promise<SendResult> {
  return sendOrQueue(
    () => createSideRequest(input),
    async () => enqueue({ kind: "sideRequest", input }),
  );
}

async function uploadPhotos(orderId: string, kind: "before" | "after", files: File[], authorId: string) {
  for (const file of files) await uploadOrderPhoto({ orderId, kind, file, authorId });
}

// Достаём сохранённые фото по id. Пропавшие (браузер очистил хранилище) пропускаем.
async function loadPhotos(ids: string[]): Promise<File[]> {
  const files: File[] = [];
  for (const id of ids) {
    const file = await loadPhoto(id);
    if (file) files.push(file);
  }
  return files;
}

async function sendQueued(item: QueuedAction): Promise<{ ok: boolean; error?: string }> {
  switch (item.kind) {
    case "transition":
      return transitionOrder(item.input);
    case "createOrder": {
      const res = await createOrder(item.input);
      if (res.ok) await uploadPhotos(res.data.orderId, "before", await loadPhotos(item.photoIds), item.authorId);
      return res;
    }
    case "complete":
      await uploadPhotos(item.input.orderId, "after", await loadPhotos(item.photoIds), item.authorId);
      return completeOrder(item.input);
    case "sideRequest":
      return createSideRequest(item.input);
  }
}

// Отправить очередь по порядку. Сеть снова пропала — останавливаемся, остаток ждёт.
// Сервер отказал (например, мастер уже отменил наряд) — действие убираем и сообщаем.
let flushing = false;

export async function flushQueue(): Promise<{ sent: number; failed: string[] }> {
  if (flushing) return { sent: 0, failed: [] };
  flushing = true;
  let sent = 0;
  const failed: string[] = [];
  try {
    for (const item of read()) {
      let res;
      try {
        res = await sendQueued(item);
      } catch {
        break; // сети снова нет
      }
      if (res.ok) sent++;
      else failed.push(res.error ?? "");
      // Убираем отправленное (или отклонённое сервером) действие и его фото.
      write(read().filter((q) => q.id !== item.id));
      if ("photoIds" in item) for (const id of item.photoIds) await deletePhoto(id).catch(() => {});
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}
