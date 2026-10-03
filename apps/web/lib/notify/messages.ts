import { t, type MessageKey } from "@/lib/i18n";
import type { OrderPriority, OrderStatus } from "@/lib/orders/types";

// Тексты уведомлений. Шаблоны — в словаре (раздел notify), здесь только подстановка значений.
// Время показываем по часовому поясу Костаная: сервер работает в UTC.

const TIME_ZONE = "Asia/Qostanay";

function fill(key: MessageKey, values: Record<string, string | number>): string {
  const text = Object.entries(values).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), t(key));
  // «Ахметов Е.» перед точкой шаблона даёт «Е..» — оставляем одну точку.
  return text.replace(/\.\./g, ".");
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

// Короткое ФИО: «Ахметов Ерлан» -> «Ахметов Е.», как в примере из кейса.
export function shortName(fullName: string): string {
  const [surname, name] = fullName.split(" ");
  return name ? `${surname} ${name[0]}.` : surname;
}

type OrderFacts = {
  number: number;
  priority: OrderPriority;
  status: OrderStatus;
  description: string;
  equipment: string;
  section: string;
  dueAt: string;
  workerName: string | null;
};

const place = (o: OrderFacts) => `${o.equipment}, ${o.section.toLowerCase()}`;

export function newOrderText(o: OrderFacts): string {
  return fill("notify.newOrder", {
    number: o.number,
    priority: t(`orders.priority.${o.priority}`),
    place: place(o),
    description: o.description,
    due: formatTime(o.dueAt),
  });
}

export function remindText(o: OrderFacts, minutesLeft: number): string {
  return fill("notify.remind", { number: o.number, minutes: minutesLeft, place: place(o), status: t(`orders.status.${o.status}`) });
}

// «Наряд №147 просрочен на 45 мин. Дробилка КМД-1750, участок дробления. Исполнитель: Ахметов Е.
//  Статус: в работе с 09:20. Последний комментарий: “ждём подшипник со склада”» — пример из кейса, п. 6.1.
export function overdueText(o: OrderFacts, minutesLate: number, statusSince: string, lastComment: string | null): string {
  return (
    fill("notify.overdue", {
      number: o.number,
      minutes: minutesLate,
      place: place(o),
      worker: o.workerName ? shortName(o.workerName) : "—",
      status: t(`orders.status.${o.status}`).toLowerCase(),
      since: formatTime(statusSince),
    }) + (lastComment ? fill("notify.lastComment", { comment: lastComment }) : "")
  );
}

export function notAcceptedText(o: OrderFacts, minutes: number, freeWorkers: string[]): string {
  return fill("notify.notAccepted", {
    number: o.number,
    priority: t(`orders.priority.${o.priority}`).toLowerCase(),
    minutes,
    worker: o.workerName ? shortName(o.workerName) : "—",
    candidates: freeWorkers.length ? freeWorkers.map(shortName).join(", ") : t("notify.noFreeWorkers"),
  });
}

export function leadOverdueText(o: OrderFacts, minutesLate: number): string {
  return fill("notify.leadOverdue", {
    number: o.number,
    minutes: minutesLate,
    place: place(o),
    worker: o.workerName ? shortName(o.workerName) : "—",
  });
}

export function reviewReadyText(r: { number: number; verdict: string; score: number; summary: string }): string {
  const verdict = t(`ai.verdict.${r.verdict}` as MessageKey);
  return fill("notify.reviewReady", { number: r.number, verdict, score: r.score, summary: r.summary });
}

// Смена статуса: доработка, отмена, закрытие — исполнителю; отказ и пауза — мастеру.
export type StatusNotifyAction = "rework" | "cancel" | "close" | "reject" | "pause";

export function statusChangeText(
  action: StatusNotifyAction,
  o: { number: number; equipment: string; section: string; workerName: string | null },
  reason: string | null,
): string {
  return fill(`notify.status.${action}`, {
    number: o.number,
    place: `${o.equipment}, ${o.section.toLowerCase()}`,
    worker: o.workerName ? shortName(o.workerName) : "—",
    reason: reason ?? "—",
  });
}
