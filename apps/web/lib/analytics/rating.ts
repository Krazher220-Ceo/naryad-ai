import "server-only";
import { createClient } from "@/lib/supabase/server";

// Рейтинг исполнителей (п. 6.6 кейса). Считает код, модель только поясняет.
// Пять составляющих из кейса, каждая приводится к шкале 0–100:
//   quality   — средняя оценка качества (оценка мастера, если он её менял, иначе ИИ), 1–5 -> 0–100;
//   onTime    — доля нарядов, исполненных в срок;
//   noReturns — доля нарядов БЕЗ возврата на доработку и без повторной поломки
//               (тот же шифр на том же оборудовании в течение 7 дней — ремонт не устранил причину);
//   volume    — количество и сложность: сумма нормативных часов закрытых нарядов относительно лучшего в периоде;
//   noRefusal — доля выданных нарядов без отказа по неуважительной причине.
// Итог — взвешенная сумма. Веса — предложение команды, их можно поменять в одном месте ниже.

export const WEIGHTS = { quality: 0.35, onTime: 0.25, noReturns: 0.2, volume: 0.1, noRefusal: 0.1 } as const;

// Меньше пяти закрытых нарядов — рейтинг ненадёжен, показываем пометку «мало данных».
export const MIN_ORDERS = 5;

// Отказы по этим причинам уважительные и рейтинг не снижают.
const EXCUSED_REJECTS = ["no_materials", "no_permit", "busy_emergency"];
const REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RatingRow = {
  workerId: string;
  fullName: string;
  brigade: string | null;
  closedOrders: number;
  total: number; // 0–100
  parts: { quality: number; onTime: number; noReturns: number; volume: number; noRefusal: number };
  facts: { avgScore: number | null; late: number; returns: number; repeats: number; normHours: number; badRefusals: number };
  lowData: boolean;
};

type Order = {
  id: string;
  assignee_id: string | null;
  equipment_id: string;
  type: "planned" | "unplanned";
  status: string;
  due_at: string;
  done_at: string | null;
  created_at: string;
  fault_code: string | null;
  fault: { norm_hours: number } | null;
};

export async function getRating(from: Date, to: Date): Promise<RatingRow[]> {
  const supabase = await createClient();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [workersRes, ordersRes, laterRes, eventsRes, reviewsRes] = await Promise.all([
    supabase.from("employees").select("id, full_name, brigade").eq("role", "worker").order("full_name"),
    supabase
      .from("work_orders")
      .select("id, assignee_id, equipment_id, type, status, due_at, done_at, created_at, fault_code, fault:fault_code ( norm_hours )")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    // Наряды после периода — чтобы увидеть повторную поломку в течение 7 дней после конца периода.
    supabase
      .from("work_orders")
      .select("equipment_id, fault_code, created_at")
      .eq("type", "unplanned")
      .gte("created_at", fromIso)
      .lte("created_at", new Date(to.getTime() + REPEAT_WINDOW_MS).toISOString()),
    supabase
      .from("work_order_events")
      .select("order_id, action, actor_id, reason_code")
      .in("action", ["rework", "reject"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase
      .from("ai_reviews")
      .select("order_id, score, master_score, created_at")
      .gte("created_at", fromIso)
      .order("created_at"),
  ]);
  for (const r of [workersRes, ordersRes, laterRes, eventsRes, reviewsRes]) if (r.error) throw r.error;

  const orders = (ordersRes.data ?? []) as Order[];
  const unplanned = laterRes.data ?? [];
  const events = eventsRes.data ?? [];

  // Последняя оценка по каждому наряду: мастер важнее ИИ.
  const scoreByOrder = new Map<string, number>();
  for (const r of reviewsRes.data ?? []) {
    const score = r.master_score ?? r.score;
    if (score) scoreByOrder.set(r.order_id, score);
  }

  const rows = (workersRes.data ?? []).map((w) => {
    const mine = orders.filter((o) => o.assignee_id === w.id);
    const closed = mine.filter((o) => o.status === "closed" && o.done_at);

    const scores = closed.map((o) => scoreByOrder.get(o.id)).filter((s): s is number => s !== undefined);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const late = closed.filter((o) => o.done_at! > o.due_at).length;

    const reworked = new Set(events.filter((e) => e.action === "rework").map((e) => e.order_id));
    const returns = closed.filter((o) => reworked.has(o.id)).length;
    // Повторная поломка: внеплановый наряд с тем же шифром на то же оборудование в течение 7 дней.
    const repeats = closed.filter((o) => {
      if (!o.fault_code) return false;
      const done = new Date(o.done_at!).getTime();
      return unplanned.some((u) => {
        const t = new Date(u.created_at).getTime();
        return u.equipment_id === o.equipment_id && u.fault_code === o.fault_code && t > done && t - done <= REPEAT_WINDOW_MS;
      });
    }).length;

    const normHours = closed.reduce((sum, o) => sum + (o.fault?.norm_hours ?? 0), 0);

    const rejects = events.filter((e) => e.action === "reject" && e.actor_id === w.id);
    const badRefusals = rejects.filter((e) => !e.reason_code || !EXCUSED_REJECTS.includes(e.reason_code)).length;
    const assignedCount = mine.length + rejects.length; // отклонённые и переназначенные ушли другому

    // Нет нарядов — нечего засчитывать: доля 0, а не 100. Иначе новичок без работы обгонял бы опытных.
    const share = (bad: number, all: number) => (all > 0 ? (1 - bad / all) * 100 : 0);
    const parts = {
      // Нет оценок — нейтральные 50, но только если наряды были.
      quality: avgScore !== null ? ((avgScore - 1) / 4) * 100 : closed.length > 0 ? 50 : 0,
      onTime: share(late, closed.length),
      noReturns: share(Math.min(closed.length, returns + repeats), closed.length),
      volume: 0, // заполняется ниже, когда известен лучший объём в периоде
      noRefusal: share(badRefusals, assignedCount),
    };

    return {
      workerId: w.id,
      fullName: w.full_name,
      brigade: w.brigade,
      closedOrders: closed.length,
      total: 0,
      parts,
      facts: { avgScore, late, returns, repeats, normHours, badRefusals },
      lowData: closed.length < MIN_ORDERS,
    };
  });

  // Объём — относительно лучшего исполнителя периода.
  const maxHours = Math.max(1, ...rows.map((r) => r.facts.normHours));
  for (const r of rows) {
    r.parts.volume = (r.facts.normHours / maxHours) * 100;
    // Целые проценты: на экране и в объяснении дробные доли не нужны.
    for (const key of Object.keys(r.parts) as (keyof typeof r.parts)[]) r.parts[key] = Math.round(r.parts[key]);
    r.total = Math.round(
      r.parts.quality * WEIGHTS.quality +
        r.parts.onTime * WEIGHTS.onTime +
        r.parts.noReturns * WEIGHTS.noReturns +
        r.parts.volume * WEIGHTS.volume +
        r.parts.noRefusal * WEIGHTS.noRefusal,
    );
  }

  // Сначала надёжные рейтинги по убыванию, «мало данных» — в конце.
  return rows.sort((a, b) => Number(a.lowData) - Number(b.lowData) || b.total - a.total);
}
