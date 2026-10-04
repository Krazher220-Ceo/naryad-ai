import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, InlineNotice, PriorityBadge, StatusBadge } from "@/components/ui";
import { RepairHistory } from "@/components/worker/OrderExtras";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const OPEN = ["issued", "accepted", "queued", "in_progress", "paused", "rework"] as const;

// «Отсканировал машину» (PLAN.md, раздел 8.4).
// Есть свой открытый наряд на этой машине — сразу кнопка к нему.
// Нет — только просмотр: поломки и простой за 30 дней, как чинили раньше.
export default async function ScannedEquipmentPage({ params }: PageProps<"/worker/equipment/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const employee = await requireRole("worker");
  const t = await getT();
  const supabase = await createClient();

  const [{ data: equipment }, { data: myOrders }, { data: stats }, { data: history }] = await Promise.all([
    supabase.from("equipment").select("id, name, inventory_no, type, section:section_id ( name )").eq("id", id).maybeSingle(),
    supabase
      .from("work_orders")
      .select("id, number, description, status, priority")
      .eq("equipment_id", id)
      .eq("assignee_id", employee.id)
      .in("status", [...OPEN])
      .order("created_at", { ascending: false }),
    supabase.rpc("equipment_recent_stats", { p_equipment_id: id }),
    supabase.rpc("equipment_repair_history", { p_equipment_id: id }),
  ]);
  if (!equipment) notFound();
  const s = stats?.[0];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
      <Card className="flex flex-col gap-1">
        <span className="text-sm font-bold tracking-wide uppercase text-brand-hover">{t("scanned.scannedLabel")}</span>
        <h1 className="text-2xl font-semibold text-ink">{equipment.name}</h1>
        <span className="text-base text-ink-muted">
          {[equipment.section?.name, equipment.inventory_no].filter(Boolean).join(" · ")}
        </span>
      </Card>

      {myOrders && myOrders.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-ink">{t("scanned.myOrder")}</h2>
          {myOrders.map((o) => (
            <Card key={o.id} tone={o.priority === "emergency" ? "emergency" : "default"} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={o.priority} />
                <StatusBadge status={o.status} />
                <span className="ml-auto text-base font-semibold text-ink">№{o.number}</span>
              </div>
              <p className="text-lg font-bold text-ink">{o.description}</p>
              <Link
                href={o.status === "in_progress" ? `/worker/orders/${o.id}/close` : `/worker/orders/${o.id}`}
                className="flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-hover"
              >
                {o.status === "in_progress" ? t("orders.action.complete") : t("scanned.openOrder")}
              </Link>
            </Card>
          ))}
        </section>
      ) : (
        <InlineNotice>{t("scanned.noMyOrder")}</InlineNotice>
      )}

      {s && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: s.breakdowns_30d, label: t("scanned.breakdowns") },
            { n: `${s.downtime_hours} ${t("scanned.hours")}`, label: t("scanned.downtime") },
            { n: s.open_orders, label: t("scanned.openNow") },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-line bg-surface px-3 py-2.5">
              <div className="font-display text-2xl leading-tight font-semibold text-ink">{c.n}</div>
              <div className="text-sm text-ink-muted">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <RepairHistory items={history ?? []} />
      </Card>
    </main>
  );
}
