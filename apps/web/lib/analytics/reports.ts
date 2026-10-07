// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import type { Db } from "./db";
import { getRating } from "./rating";
import { downtimeMinutes, loadHistory, type History } from "./history";

// Отчёты по материалам и простоям и показатели дашборда руководителя (раздел 7 кейса).
// Всё считает код из одной и той же истории (history.ts).

const DAY = 24 * 60 * 60 * 1000;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function periodFromDays(days: number) {
  const to = new Date();
  return { from: new Date(to.getTime() - days * DAY), to };
}

// ---------- Материалы ----------
// Норма по наряду = обычный расход материала (typical_qty). Отклонение = (факт − норма) / норма.

export type MaterialRow = {
  key: string;
  name: string;
  unit?: string;
  qty: number;
  norm: number;
  deviationPct: number;
  orders: number;
};

function materialRows(h: History, keyOf: (orderId: string, materialName: string) => { key: string; name: string; unit?: string } | null) {
  const map = new Map<string, MaterialRow>();
  for (const u of h.usages) {
    if (!u.material) continue;
    const k = keyOf(u.order_id, u.material.name);
    if (!k) continue;
    const row = map.get(k.key) ?? { key: k.key, name: k.name, unit: k.unit, qty: 0, norm: 0, deviationPct: 0, orders: 0 };
    row.qty += u.qty;
    row.norm += u.material.typical_qty;
    row.orders += 1;
    map.set(k.key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, qty: round1(r.qty), norm: round1(r.norm), deviationPct: r.norm > 0 ? Math.round(((r.qty - r.norm) / r.norm) * 100) : 0 }))
    .sort((a, b) => b.deviationPct - a.deviationPct);
}

export async function getMaterialsReport(days: number, db?: Db) {
  const { from, to } = periodFromDays(days);
  const h = await loadHistory(from, to, db);
  const order = new Map(h.orders.map((o) => [o.id, o]));
  const unitOf = new Map(h.usages.filter((u) => u.material).map((u) => [u.material!.name, u.material!.unit]));

  return {
    byMaterial: materialRows(h, (_id, name) => ({ key: name, name, unit: unitOf.get(name) })),
    bySection: materialRows(h, (id) => {
      const s = order.get(id)?.section;
      return s ? { key: s.id, name: s.name } : null;
    }),
    byEquipment: materialRows(h, (id) => {
      const e = order.get(id)?.equipment;
      return e ? { key: e.id, name: e.name } : null;
    }),
    byWorker: materialRows(h, (id) => {
      const a = order.get(id)?.assignee;
      return a ? { key: a.id, name: a.full_name } : null;
    }),
  };
}

export type MaterialsReport = Awaited<ReturnType<typeof getMaterialsReport>>;

// ---------- Простои ----------
// Простой = время внеплановых нарядов от выдачи до исполнения.

export async function getDowntimeReport(days: number, db?: Db) {
  const { from, to } = periodFromDays(days);
  const h = await loadHistory(from, to, db);
  const done = h.orders.filter((o) => o.status !== "cancelled");

  const byEquipment = new Map<string, { name: string; section: string; hours: number; unplanned: number; planned: number; categories: Record<string, number> }>();
  for (const o of done) {
    if (!o.equipment) continue;
    const row = byEquipment.get(o.equipment.id) ?? { name: o.equipment.name, section: o.section?.name ?? "—", hours: 0, unplanned: 0, planned: 0, categories: {} };
    if (o.type === "unplanned") {
      row.unplanned += 1;
      row.hours += downtimeMinutes(o) / 60;
      const category = o.fault_code?.[0] ?? "?";
      row.categories[category] = (row.categories[category] ?? 0) + downtimeMinutes(o) / 60;
    } else {
      row.planned += 1;
    }
    byEquipment.set(o.equipment.id, row);
  }

  const rows = [...byEquipment.values()]
    .map((r) => ({
      ...r,
      hours: round1(r.hours),
      categories: Object.fromEntries(Object.entries(r.categories).map(([c, hrs]) => [c, round1(hrs)])),
      unplannedSharePct: Math.round((r.unplanned / Math.max(1, r.unplanned + r.planned)) * 100),
      // Главная причина простоя — категория шифра с наибольшими часами.
      topCategory: Object.entries(r.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = round1(rows.reduce((s, r) => s + r.hours, 0));
  const byCategory = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      for (const [c, hrs] of Object.entries(r.categories)) acc[c] = (acc[c] ?? 0) + hrs;
      return acc;
    }, {}),
  )
    .map(([category, hours]) => ({ category, hours: round1(hours) }))
    .sort((a, b) => b.hours - a.hours);

  const planned = done.filter((o) => o.type === "planned").length;
  return { rows, totalHours, byCategory, plannedSharePct: Math.round((planned / Math.max(1, done.length)) * 100) };
}

export type DowntimeReport = Awaited<ReturnType<typeof getDowntimeReport>>;

// ---------- Дашборд руководителя ----------

const minutesBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export async function getDashboard(days: number, db?: Db) {
  const { from, to } = periodFromDays(days);
  const [h, rating, downtime] = await Promise.all([loadHistory(from, to, db), getRating(from, to, db), getDowntimeReport(days, db)]);
  const now = new Date().toISOString();
  const open = h.orders.filter((o) => !["closed", "cancelled", "done", "ai_review"].includes(o.status));

  const reaction = avg(h.orders.filter((o) => o.accepted_at).map((o) => minutesBetween(o.created_at, o.accepted_at!)));
  const execution = avg(h.orders.filter((o) => o.started_at && o.done_at).map((o) => minutesBetween(o.started_at!, o.done_at!)));

  return {
    inWork: open.filter((o) => ["in_progress", "paused", "accepted"].includes(o.status)).length,
    waiting: open.filter((o) => ["issued", "queued"].includes(o.status)).length,
    overdue: open.filter((o) => o.due_at < now).length,
    avgReactionMin: reaction === null ? null : Math.round(reaction),
    avgExecutionMin: execution === null ? null : Math.round(execution),
    downtimeHours: downtime.totalHours,
    topEquipment: downtime.rows.slice(0, 5).map((r) => ({ name: r.name, hours: r.hours, unplanned: r.unplanned })),
    bestWorkers: rating.filter((r) => !r.lowData).slice(0, 5).map((r) => ({ name: r.fullName, total: r.total })),
    ordersInPeriod: h.orders.length,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
