import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_HOME, type Role } from "@/lib/auth/roles";

export type CurrentEmployee = { id: string; fullName: string; role: Role };

// Текущий сотрудник или null, если не вошёл или нет записи в employees.
// cache — один запрос на всю отрисовку: макет и страница не ходят в базу дважды.
export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
  const supabase = await createClient();
  // getClaims проверяет подпись токена на месте, без запроса к Supabase Auth
  // (если ключи проекта симметричные, сам обращается к серверу, как getUser).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("employees")
    .select("id, full_name, role")
    .eq("auth_user_id", userId)
    .single();
  if (!data || !isRole(data.role)) return null;

  return { id: data.id, fullName: data.full_name, role: data.role };
});

// Пускает только сотрудника нужной роли, остальных отправляет на их экран.
export async function requireRole(role: Role): Promise<CurrentEmployee> {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== role) redirect(ROLE_HOME[employee.role]);
  return employee;
}
