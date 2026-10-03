import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, ROLE_HOME, type Role } from "@/lib/auth/roles";

export type CurrentEmployee = { id: string; fullName: string; role: Role };

// Текущий сотрудник или null, если не вошёл или нет записи в employees.
export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const supabase = await createClient();
  // getUser проверяет токен на сервере Supabase, getSession ему не равен по надёжности.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase
    .from("employees")
    .select("id, full_name, role")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (!data || !isRole(data.role)) return null;

  return { id: data.id, fullName: data.full_name, role: data.role };
}

// Пускает только сотрудника нужной роли, остальных отправляет на их экран.
export async function requireRole(role: Role): Promise<CurrentEmployee> {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== role) redirect(ROLE_HOME[employee.role]);
  return employee;
}
