"use client";

import { transitionOrder, type TransitionInput } from "@/lib/orders/actions";

// Офлайн-очередь действий исполнителя (п. 5.3.5 кейса: «действия сохраняются на телефоне
// и отправляются при появлении сети»).
//
// Как работает:
// 1. sendTransition пробует отправить действие сразу.
// 2. Нет сети (браузер офлайн или запрос не дошёл) — действие кладётся в localStorage.
// 3. flushQueue при появлении сети отправляет сохранённое по порядку.
// Дублей не бывает: у каждого действия свой clientActionId, и база не выполняет
// действие с уже известным id второй раз (функции 0003_order_functions.sql).

const KEY = "naryad-offline-queue";
export const QUEUE_EVENT = "naryad-queue-changed";

export type QueuedAction = { kind: "transition"; input: TransitionInput; queuedAt: string };
export type SendResult = { ok: true; queued: boolean } | { ok: false; error: string };

function read(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedAction[];
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

function enqueue(input: TransitionInput) {
  write([...read(), { kind: "transition", input, queuedAt: new Date().toISOString() }]);
}

export async function sendTransition(input: TransitionInput): Promise<SendResult> {
  if (!navigator.onLine) {
    enqueue(input);
    return { ok: true, queued: true };
  }
  try {
    const res = await transitionOrder(input);
    return res.ok ? { ok: true, queued: false } : res;
  } catch {
    // Запрос не дошёл до сервера — сохраняем и отправим позже.
    enqueue(input);
    return { ok: true, queued: true };
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
        res = await transitionOrder(item.input);
      } catch {
        break; // сети снова нет
      }
      if (res.ok) sent++;
      else failed.push(res.error);
      // Убираем отправленное (или отклонённое сервером) действие из начала очереди.
      write(read().filter((q) => q.input.clientActionId !== item.input.clientActionId));
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}
