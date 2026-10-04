import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { OperatorRequests, type OperatorRequestItem } from "./OperatorRequests";

// «Мои заявки» оператора. С общим логином участка — заявки этого логина из базы.
// Без входа — по номеру телефона (загружаются в браузере, номер хранится только на телефоне).
export default async function OperatorHomePage() {
  const t = await getT();
  const employee = await getCurrentEmployee();

  let initial: OperatorRequestItem[] | null = null;
  if (employee?.role === "operator") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("requests")
      .select("id, number, created_at, status, description, dismiss_reason, equipment:equipment_id ( name ), section:section_id ( name ), order:order_id ( number )")
      .eq("created_by", employee.id)
      .order("created_at", { ascending: false })
      .limit(30);
    initial = (data ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      created_at: r.created_at,
      status: r.status,
      description: r.description,
      dismiss_reason: r.dismiss_reason,
      equipment_name: r.equipment?.name ?? null,
      section_name: r.section?.name ?? null,
      order_number: r.order?.number ?? null,
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl lg:py-8">
      <h1 className="hidden text-3xl font-semibold text-ink lg:block">{t("shell.nav.myRequests")}</h1>
      <OperatorRequests initial={initial} accountName={employee?.role === "operator" ? employee.fullName : null} />
    </main>
  );
}
