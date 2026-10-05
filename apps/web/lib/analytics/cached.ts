import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { findAnomalies } from "./anomalies";
import { getRating } from "./rating";
import { getDashboard, getDowntimeReport, getMaterialsReport, periodFromDays } from "./reports";
import { currentShift, getShiftReport, shiftWindow, type Shift } from "./shift";
import { getSnapshot, storeSnapshot, type AiPart, type Snapshot } from "./snapshots";

// Какие отчёты кэшируются и как каждый считается по ключу (kind, scope).
// Одно место для страниц, выгрузки, кнопки «Обновить сейчас» и ночного расписания.
//   scope периодных отчётов — число дней: «7», «30», «90»
//   scope смены — «2026-10-03:A»

export const REPORT_KINDS = ["shift", "rating", "anomalies", "dashboard", "materials", "downtime"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const isReportKind = (x: string): x is ReportKind => (REPORT_KINDS as readonly string[]).includes(x);

const DAY_SCOPES = ["7", "30", "90"];
const ANOMALY_SCOPES = ["30", "90"];
const SHIFT_HISTORY_DAYS = 60;

function parseShiftScope(scope: string): { date: string; shift: Shift } | null {
  const m = /^(\d{4}-\d{2}-\d{2}):([AB])$/.exec(scope);
  if (!m || Number.isNaN(new Date(`${m[1]}T00:00:00Z`).getTime())) return null;
  // Только недавние и не будущие смены: иначе таблица обрастала бы произвольными датами.
  const today = currentShift().date;
  const oldest = new Date(new Date(`${today}T00:00:00Z`).getTime() - SHIFT_HISTORY_DAYS * 86400_000).toISOString().slice(0, 10);
  if (m[1] > today || m[1] < oldest) return null;
  return { date: m[1], shift: m[2] as Shift };
}

type Job = {
  valid: (scope: string) => boolean;
  run: (scope: string, db: Db) => Promise<unknown>;
  ai?: (value: never) => AiPart;
};

const JOBS: Record<ReportKind, Job> = {
  shift: {
    valid: (s) => parseShiftScope(s) !== null,
    run: (s, db) => {
      const p = parseShiftScope(s)!;
      return getShiftReport(p.date, p.shift, db);
    },
    ai: (r: Awaited<ReturnType<typeof getShiftReport>>) => ({ text: r.summary.summary, source: r.summary.source }),
  },
  rating: {
    valid: (s) => DAY_SCOPES.includes(s),
    run: (s, db) => {
      const { from, to } = periodFromDays(Number(s));
      return getRating(from, to, db);
    },
  },
  anomalies: {
    valid: (s) => ANOMALY_SCOPES.includes(s),
    run: (s, db) => findAnomalies(Number(s), true, db),
    ai: (r: Awaited<ReturnType<typeof findAnomalies>>) => ({
      text: r.anomalies.map((a) => ({ id: a.id, text: a.text, recommendation: a.recommendation })),
      source: r.anomalies.some((a) => a.source === "llm") ? "llm" : "rules",
    }),
  },
  dashboard: { valid: (s) => DAY_SCOPES.includes(s), run: (s, db) => getDashboard(Number(s), db) },
  materials: { valid: (s) => DAY_SCOPES.includes(s), run: (s, db) => getMaterialsReport(Number(s), db) },
  downtime: { valid: (s) => DAY_SCOPES.includes(s), run: (s, db) => getDowntimeReport(Number(s), db) },
};

export const isValidScope = (kind: ReportKind, scope: string) => JOBS[kind].valid(scope);

// Пересчёт без ожидания срока: служебный клиент, чтобы результат не зависел от того, кто нажал кнопку.
export function recompute(kind: ReportKind, scope: string): Promise<Snapshot<unknown>> {
  const job = JOBS[kind];
  return storeSnapshot(kind, scope, () => job.run(scope, createAdminClient()), job.ai as (v: unknown) => AiPart);
}

// Чтение для страниц. Нестандартный период (например, 45 дней в выгрузке) в кэш не кладём:
// считаем как раньше, от имени пользователя.
function read<T>(kind: ReportKind, scope: string, live: () => Promise<T>, maxAgeHours = 24): Promise<Snapshot<T>> {
  const job = JOBS[kind];
  if (!job.valid(scope)) return live().then((data) => ({ data, computedAt: null }));
  return getSnapshot<T>(kind, scope, () => job.run(scope, createAdminClient()) as Promise<T>, maxAgeHours, job.ai as ((v: T) => AiPart) | undefined);
}

export function cachedShift(date: string, shift: Shift) {
  // Идущая смена меняется каждый час, поэтому для неё срок кэша короче. Завершённая — сутки.
  const running = shiftWindow(date, shift).end.getTime() > Date.now();
  return read("shift", `${date}:${shift}`, () => getShiftReport(date, shift), running ? 1 : 24);
}

export function cachedRating(days: number) {
  const { from, to } = periodFromDays(days);
  return read("rating", String(days), () => getRating(from, to));
}

export const cachedAnomalies = (days: number) => read("anomalies", String(days), () => findAnomalies(days));
export const cachedDashboard = (days: number) => read("dashboard", String(days), () => getDashboard(days));
export const cachedMaterials = (days: number) => read("materials", String(days), () => getMaterialsReport(days));
export const cachedDowntime = (days: number) => read("downtime", String(days), () => getDowntimeReport(days));

// Всё, что считается по расписанию: периоды 7/30/90 и две последние смены.
export function allSnapshotKeys(): { kind: ReportKind; scope: string }[] {
  const { date, shift } = currentShift();
  const prevShift: { date: string; shift: Shift } =
    shift === "B"
      ? { date, shift: "A" }
      : { date: new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400_000).toISOString().slice(0, 10), shift: "B" };
  return [
    { kind: "shift", scope: `${date}:${shift}` },
    { kind: "shift", scope: `${prevShift.date}:${prevShift.shift}` },
    ...DAY_SCOPES.flatMap((scope) => (["rating", "dashboard", "materials", "downtime"] as const).map((kind) => ({ kind, scope }))),
    ...ANOMALY_SCOPES.map((scope) => ({ kind: "anomalies" as const, scope })),
  ];
}

export async function refreshAllSnapshots() {
  const keys = allSnapshotKeys();
  const results = await Promise.allSettled(keys.map((k) => recompute(k.kind, k.scope)));
  return keys.map((k, i) => ({ ...k, ok: results[i].status === "fulfilled" }));
}
