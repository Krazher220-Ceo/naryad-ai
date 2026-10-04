import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

// Сюда ведёт QR-код на оборудовании и ручной ввод номера в сканере.
// Экран зависит от роли: мастер — выдача наряда с выбранной машиной,
// исполнитель — экран «Отсканировал машину». Оператор без входа появится в M7.
export async function GET(request: Request, ctx: RouteContext<"/q/[code]">) {
  const { code } = await ctx.params;
  const employee = await getCurrentEmployee();
  // Без входа proxy уже отправил бы на /login, это запасной путь
  if (!employee) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();
  // На табличке у машины виден инвентарный номер, поэтому подходит и он.
  // Оставляем только буквы, цифры и дефис: строка идёт в фильтр запроса.
  const value = decodeURIComponent(code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const { data } = await supabase
    .from("equipment")
    .select("id")
    .or(`qr_code.eq.${value},inventory_no.eq.${value}`)
    .limit(1)
    .maybeSingle();

  if (employee.role === "worker") {
    const target = data ? `/worker/equipment/${data.id}` : "/worker/scan?notFound=1";
    return NextResponse.redirect(new URL(target, request.url));
  }
  if (employee.role === "master" && data) {
    return NextResponse.redirect(new URL(`/master/orders/new?equipment=${data.id}`, request.url));
  }
  return NextResponse.redirect(new URL(ROLE_HOME[employee.role], request.url));
}
