import "server-only";
import { createClient } from "@/lib/supabase/server";

// Загрузка истории для аналитики за период. Одна функция на все отчёты, чтобы цифры
// в аномалиях, отчётах и дашборде считались из одних и тех же данных.
// Supabase отдаёт не больше 1000 строк за запрос, поэтому читаем страницами.

const PAGE = 1000;

async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export type HistoryOrder = {
  id: string;
  number: number;
  type: "planned" | "unplanned";
  status: string;
  priority: string;
  fault_code: string | null;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  done_at: string | null;
  due_at: string;
  assignee_id: string | null;
  equipment: { id: string; name: string; type: string } | null;
  section: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

export async function loadHistory(from: Date, to: Date) {
  const supabase = await createClient();
  const f = from.toISOString();
  const t = to.toISOString();

  const orders = await all<HistoryOrder>((a, b) =>
    supabase
      .from("work_orders")
      .select(
        `id, number, type, status, priority, fault_code, created_at, accepted_at, started_at, done_at, due_at, assignee_id,
         equipment:equipment_id ( id, name, type ), section:section_id ( id, name ),
         assignee:employees!work_orders_assignee_id_fkey ( id, full_name )`,
      )
      .gte("created_at", f)
      .lte("created_at", t)
      .order("created_at")
      .range(a, b),
  );

  const usages = await all<{
    order_id: string;
    qty: number;
    material: { id: string; name: string; unit: string; typical_qty: number } | null;
  }>((a, b) =>
    supabase
      .from("material_usages")
      .select("order_id, qty, material:material_id ( id, name, unit, typical_qty ), order:order_id!inner ( created_at )")
      .gte("order.created_at", f)
      .lte("order.created_at", t)
      .range(a, b),
  );

  const reworks = await all<{ order_id: string }>((a, b) =>
    supabase.from("work_order_events").select("order_id").eq("action", "rework").gte("created_at", f).lte("created_at", t).range(a, b),
  );

  return { orders, usages, reworkedOrderIds: new Set(reworks.map((r) => r.order_id)) };
}

export type History = Awaited<ReturnType<typeof loadHistory>>;

// Ночная смена: 20:00–08:00 по Костанаю (UTC+5).
export function isNight(iso: string): boolean {
  const hour = (new Date(iso).getUTCHours() + 5) % 24;
  return hour >= 20 || hour < 8;
}

// Простой по наряду в минутах: от выдачи до исполнения (только внеплановые).
export function downtimeMinutes(o: HistoryOrder): number {
  if (o.type !== "unplanned" || !o.done_at || o.status === "cancelled") return 0;
  return Math.max(0, (new Date(o.done_at).getTime() - new Date(o.created_at).getTime()) / 60000);
}
