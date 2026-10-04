import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee } from "@/lib/notify";
import { tRu as t } from "@/lib/i18n";

// Новая заявка оператора — всем мастерам на смене (если на смене никого — всем мастерам).
// ФИО оператора в Telegram не уходит: мастер видит его в приложении.
export async function notifyNewRequest(requestId: string): Promise<void> {
  const db = createAdminClient();
  const { data: r } = await db
    .from("requests")
    .select("number, description, machine_state, equipment:equipment_id ( name ), section:section_id ( name )")
    .eq("id", requestId)
    .maybeSingle();
  if (!r) return;

  const { data: masters } = await db.from("employees").select("id, on_shift").eq("role", "master");
  const onShift = (masters ?? []).filter((m) => m.on_shift);
  const targets = onShift.length ? onShift : masters ?? [];

  const state = r.machine_state === "stopped" ? t("report.stateStopped") : r.machine_state === "defect" ? t("report.stateDefect") : "";
  const text = t("notify.newRequest")
    .replace("{number}", String(r.number))
    .replace("{place}", r.equipment?.name ?? r.section?.name ?? "—")
    .replace("{state}", state ? ` ${state}.` : "")
    .replace("{description}", r.description);

  await Promise.all(targets.map((m) => notifyEmployee({ employeeId: m.id, kind: "new_request", text })));
}
