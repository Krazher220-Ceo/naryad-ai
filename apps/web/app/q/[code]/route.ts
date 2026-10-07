// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { cleanCode } from "@/lib/requests/lookup";
import { createClient } from "@/lib/supabase/server";

// Сюда ведёт QR-код на машине, на входе в цех и ручной ввод номера в сканере.
// Экран зависит от того, кто сканирует (PLAN.md, раздел 4):
// не вошёл или оператор — заявка о поломке; исполнитель — экран «Отсканировал машину»;
// мастер — выдача наряда с выбранной машиной; руководитель — его стартовый экран.
export async function GET(request: Request, ctx: RouteContext<"/q/[code]">) {
  const { code: raw } = await ctx.params;
  const code = cleanCode(raw);
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const employee = await getCurrentEmployee();
  if (!employee || employee.role === "operator") return go(`/operator/report/${encodeURIComponent(code)}`);

  const supabase = await createClient();
  // На табличке у машины виден инвентарный номер, поэтому подходит и он.
  const { data } = await supabase
    .from("equipment")
    .select("id")
    .or(`qr_code.eq.${code},inventory_no.eq.${code}`)
    .limit(1)
    .maybeSingle();

  if (employee.role === "worker") return go(data ? `/worker/equipment/${data.id}` : "/worker/scan?notFound=1");
  if (employee.role === "master" && data) return go(`/master/orders/new?equipment=${data.id}`);
  return go(ROLE_HOME[employee.role]);
}
