import { Card } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

// Справочники (PLAN.md, раздел 8.6): цеха и оборудование деревом «цех → группа → машина»
// с QR-кодами, шифры с нормативами, материалы с нормой расхода, шаблоны ППР.
// Данные демонстрационные (AGENTS.md): это не реальные справочники завода.
export default async function LeadRefsPage() {
  const t = await getT();
  const supabase = await createClient();
  const [sections, equipment, codes, materials, templates] = await Promise.all([
    supabase.from("sections").select("id, name, qr_code").order("name"),
    supabase.from("equipment").select("id, name, inventory_no, type, section_id, qr_code").order("name"),
    supabase.from("fault_codes").select("code, category, name, norm_hours").order("code"),
    supabase.from("materials").select("id, name, unit, typical_qty").order("name"),
    supabase.from("order_templates").select("id, name, fault_code, norm_hours").order("name"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 lg:max-w-5xl lg:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink lg:text-3xl">{t("refs.title")}</h1>
        <p className="text-base text-ink-muted">{t("refs.hint")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">{t("refs.equipment")}</h2>
        {(sections.data ?? []).map((s) => {
          const items = (equipment.data ?? []).filter((e) => e.section_id === s.id);
          const groups = [...new Set(items.map((e) => e.type))];
          return (
            <details key={s.id} className="rounded-2xl border border-line bg-surface">
              <summary className="flex min-h-touch cursor-pointer items-center justify-between gap-2 px-4 text-lg font-bold text-ink">
                <span>{s.name}</span>
                <span className="font-mono text-sm font-semibold text-ink-muted">
                  {s.qr_code ?? ""} · {items.length}
                </span>
              </summary>
              <div className="flex flex-col gap-3 px-4 pb-4">
                {groups.map((g) => (
                  <div key={g} className="flex flex-col gap-1">
                    <b className="text-base capitalize text-ink-muted">{g}</b>
                    {items
                      .filter((e) => e.type === g)
                      .map((e) => (
                        <div key={e.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-base">
                          <span className="font-semibold text-ink">{e.name}</span>
                          <span className="font-mono text-sm text-ink-muted">{e.inventory_no} · QR {e.qr_code ?? "—"}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-ink">{t("refs.codes")}</h2>
          <Card className="flex flex-col divide-y divide-line p-0">
            {(codes.data ?? []).map((c) => (
              <div key={c.code} className="flex justify-between gap-3 px-4 py-2.5 text-base">
                <span className="text-ink">
                  <b className="font-mono">{c.code}</b> {c.name}
                </span>
                <span className="shrink-0 text-ink-muted">{t("refs.normHours").replace("{n}", String(c.norm_hours))}</span>
              </div>
            ))}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-ink">{t("refs.materials")}</h2>
          <Card className="flex flex-col divide-y divide-line p-0">
            {(materials.data ?? []).map((m) => (
              <div key={m.id} className="flex justify-between gap-3 px-4 py-2.5 text-base">
                <span className="text-ink">{m.name}</span>
                <span className="shrink-0 text-ink-muted">
                  {t("refs.norm")}: {m.typical_qty} {m.unit}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">{t("refs.templates")}</h2>
        <Card className="flex flex-col divide-y divide-line p-0">
          {(templates.data ?? []).map((tpl) => (
            <div key={tpl.id} className="flex justify-between gap-3 px-4 py-2.5 text-base">
              <span className="text-ink">{tpl.name}</span>
              <span className="shrink-0 text-ink-muted">
                {tpl.fault_code ?? ""} {tpl.norm_hours ? `· ${t("refs.normHours").replace("{n}", String(tpl.norm_hours))}` : ""}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </main>
  );
}
