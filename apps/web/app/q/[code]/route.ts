import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

// Сюда ведёт QR-код на оборудовании. Мастер попадает в выдачу наряда с выбранным оборудованием.
export async function GET(request: Request, ctx: RouteContext<"/q/[code]">) {
  const { code } = await ctx.params;
  const employee = await getCurrentEmployee();
  // Без входа proxy уже отправил бы на /login, это запасной путь
  if (!employee) return NextResponse.redirect(new URL("/login", request.url));

  if (employee.role !== "master") {
    return NextResponse.redirect(new URL(ROLE_HOME[employee.role], request.url));
  }

  const supabase = await createClient();
  const { data } = await supabase.from("equipment").select("id").eq("qr_code", code).maybeSingle();
  if (!data) return NextResponse.redirect(new URL(ROLE_HOME.master, request.url));

  return NextResponse.redirect(new URL(`/master/orders/new?equipment=${data.id}`, request.url));
}
