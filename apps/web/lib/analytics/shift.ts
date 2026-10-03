import "server-only";
import { createClient } from "@/lib/supabase/server";
import { summarizeShift } from "@/lib/ai/summaries";

// Отчёт за смену (раздел 7 кейса): выдано / выполнено / просрочено / отклонено,
// загрузка людей, простои, итоговая сводка ИИ текстом.
// Цифры считает код. Модель получает готовые цифры и пишет 2–3 предложения.
//
// Смены по времени Костаная (UTC+5): A — дневная 08:00–20:00, B — ночная 20:00–08:00 следующего дня.

export type Shift = "A" | "B";

const QOSTANAY_OFFSET_HOURS = 5;

// Начало и конец смены в UTC для даты вида "2026-10-03".
export function shiftWindow(date: string, shift: Shift): { start: Date; end: Date } {
  const localStartHour = shift === "A" ? 8 : 20;
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCHours(localStartHour - QOSTANAY_OFFSET_HOURS);
  const end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
  return { start, end };
}

// Текущая смена и её дата по местному времени.
export function currentShift(now: Date = new Date()): { date: string; shift: Shift } {
  const local = new Date(now.getTime() + QOSTANAY_OFFSET_HOURS * 3600_000);
  const hour = local.getUTCHours();
  if (hour >= 8 && hour < 20) return { date: local.toISOString().slice(0, 10), shift: "A" };
  // Ночь после полуночи относится к смене, начавшейся вчера в 20:00.
  const shiftDay = hour < 8 ? new Date(local.getTime() - 24 * 3600_000) : local;
  return { date: shiftDay.toISOString().slice(0, 10), shift: "B" };
}

const overlapMinutes = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, (Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / 60000);

export async function getShiftReport(date: string, shift: Shift) {
  const supabase = await createClient();
  const { start, end } = shiftWindow(date, shift);
  const s = start.toISOString();
  const e = end.toISOString();

  // Наряды, которые хоть как-то касаются смены: созданы до её конца и не закрыты до её начала.
  const [ordersRes, rejectsRes] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        `id, number, type, priority, status, created_at, done_at, closed_at, due_at, assignee_id,
         equipment:equipment_id ( id, name ), fault:fault_code ( norm_hours ),
         assignee:employees!work_orders_assignee_id_fkey ( id, full_name )`,
      )
      .lt("created_at", e)
      .or(`done_at.is.null,done_at.gte.${s}`),
    supabase.from("work_order_events").select("order_id").eq("action", "reject").gte("created_at", s).lt("created_at", e),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (rejectsRes.error) throw rejectsRes.error;
  const orders = ordersRes.data;

  const startMs = start.getTime();
  const endMs = Math.min(end.getTime(), Date.now());
  const inShift = (iso: string | null) => !!iso && iso >= s && iso < e;

  const issued = orders.filter((o) => inShift(o.created_at));
  const done = orders.filter((o) => inShift(o.done_at));
  // Просрочен в смене: срок прошёл до конца смены, а наряд к концу смены не исполнен
  // или исполнен в эту смену позже срока. Так считаются и наряды, просроченные ещё в прошлых сменах.
  const shiftEndIso = new Date(endMs).toISOString();
  const overdue = orders.filter(
    (o) =>
      o.status !== "cancelled" &&
      o.due_at < shiftEndIso &&
      (o.done_at === null || o.done_at >= shiftEndIso || (o.done_at >= s && o.done_at > o.due_at)),
  );

  // Загрузка людей: исполненные в смене наряды и их нормативные часы.
  const loadMap = new Map<string, { name: string; done: number; normHours: number }>();
  for (const o of done) {
    if (!o.assignee) continue;
    const row = loadMap.get(o.assignee.id) ?? { name: o.assignee.full_name, done: 0, normHours: 0 };
    row.done += 1;
    row.normHours += o.fault?.norm_hours ?? 0;
    loadMap.set(o.assignee.id, row);
  }
  const load = [...loadMap.values()].sort((a, b) => b.normHours - a.normHours);

  // Простой: время внеплановых нарядов (от выдачи до исполнения), попавшее в смену.
  const downMap = new Map<string, { name: string; minutes: number }>();
  for (const o of orders.filter((x) => x.type === "unplanned" && x.status !== "cancelled" && x.equipment)) {
    const from = new Date(o.created_at).getTime();
    const to = o.done_at ? new Date(o.done_at).getTime() : endMs;
    const minutes = overlapMinutes(from, to, startMs, endMs);
    if (minutes <= 0) continue;
    const row = downMap.get(o.equipment!.id) ?? { name: o.equipment!.name, minutes: 0 };
    row.minutes += minutes;
    downMap.set(o.equipment!.id, row);
  }
  const downtime = [...downMap.values()].map((d) => ({ ...d, minutes: Math.round(d.minutes) })).sort((a, b) => b.minutes - a.minutes);

  const counters = {
    issued: issued.length,
    done: done.length,
    overdue: overdue.length,
    rejected: new Set((rejectsRes.data ?? []).map((r) => r.order_id)).size,
    emergency: issued.filter((o) => o.priority === "emergency").length,
  };

  const summary = await summarizeShift({ date, shift, counters, load, downtime: downtime.slice(0, 5) });

  return { date, shift, start: s, end: e, counters, load, downtime, overdue: overdue.map((o) => o.number), summary };
}

export type ShiftReport = Awaited<ReturnType<typeof getShiftReport>>;
