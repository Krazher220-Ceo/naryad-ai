"use server";

import { refresh } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import type { ActionResult } from "@/lib/orders/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoLogin, isRole, loginToEmail, type Role } from "./roles";

// Пользователи и роли (PLAN.md, раздел 8.6). Только руководитель.
// Учётная запись создаётся в Supabase Auth служебным ключом, сотрудник — в employees.
// Демо-логины и собственную роль руководителя менять нельзя: иначе жюри потеряет вход.

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;

async function requireLead() {
  const me = await getCurrentEmployee();
  return me?.role === "lead" ? me : null;
}

function temporaryPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  return Array.from({ length: 4 }, () => pick(letters)).join("") + Array.from({ length: 4 }, () => pick(digits)).join("");
}

export async function addEmployee(input: {
  login: string;
  fullName: string;
  role: Role;
}): Promise<ActionResult<{ password: string }>> {
  const t = await getT();
  if (!(await requireLead())) return { ok: false, error: t("orders.errors.forbidden") };
  const login = input.login.trim().toLowerCase();
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (!LOGIN_RE.test(login)) return { ok: false, error: t("users.errors.login") };
  if (fullName.split(" ").length < 2) return { ok: false, error: t("users.errors.name") };
  if (!isRole(input.role)) return { ok: false, error: t("users.errors.role") };

  const admin = createAdminClient();
  const password = temporaryPassword();
  const created = await admin.auth.admin.createUser({ email: loginToEmail(login), password, email_confirm: true });
  if (created.error || !created.data.user) return { ok: false, error: t("users.errors.exists") };

  const { error } = await admin.from("employees").insert({ auth_user_id: created.data.user.id, login, full_name: fullName, role: input.role });
  if (error) {
    // Сотрудника не записали — убираем и учётную запись, чтобы не осталось «сироты».
    await admin.auth.admin.deleteUser(created.data.user.id);
    return { ok: false, error: t("users.errors.exists") };
  }
  refresh();
  return { ok: true, data: { password } };
}

export async function changeEmployeeRole(employeeId: string, role: Role): Promise<ActionResult<null>> {
  const t = await getT();
  const me = await requireLead();
  if (!me) return { ok: false, error: t("orders.errors.forbidden") };
  if (!isRole(role)) return { ok: false, error: t("users.errors.role") };
  if (employeeId === me.id) return { ok: false, error: t("users.errors.self") };

  const admin = createAdminClient();
  const { data: employee } = await admin.from("employees").select("login").eq("id", employeeId).maybeSingle();
  if (!employee) return { ok: false, error: t("orders.errors.notFound") };
  if (isDemoLogin(employee.login)) return { ok: false, error: t("users.errors.demo") };

  const { error } = await admin.from("employees").update({ role }).eq("id", employeeId);
  if (error) return { ok: false, error: t("orders.errors.unknown") };
  refresh();
  return { ok: true, data: null };
}
