// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use server";

import { refresh } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import type { ActionResult } from "@/lib/orders/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { passwordProblems } from "./password-rules";
import { isDemoLogin } from "./roles";

// Смена своего пароля: сначала проверяем текущий, потом ставим новый.
export async function changePassword(current: string, next: string): Promise<ActionResult<null>> {
  const t = await getT();
  if (passwordProblems(next, current).length) return { ok: false, error: t("password.errors.rules") };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) return { ok: false, error: t("password.errors.session") };
  if (isDemoLogin(email.split("@")[0])) return { ok: false, error: t("password.errors.demo") };

  // Неверный текущий пароль — отказ. Вход тем же пользователем просто обновляет сессию.
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) return { ok: false, error: t("password.errors.current") };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: t("password.errors.save") };
  return { ok: true, data: null };
}

// Сброс пароля сотрудника. Только руководитель. Возвращает временный пароль,
// его руководитель передаёт сотруднику, а тот меняет пароль в профиле.
export async function resetEmployeePassword(employeeId: string): Promise<ActionResult<{ password: string }>> {
  const t = await getT();
  const me = await getCurrentEmployee();
  if (me?.role !== "lead") return { ok: false, error: t("orders.errors.forbidden") };
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return { ok: false, error: t("orders.errors.notFound") };

  const admin = createAdminClient();
  const { data: employee } = await admin.from("employees").select("auth_user_id, login").eq("id", employeeId).maybeSingle();
  if (!employee?.auth_user_id) return { ok: false, error: t("orders.errors.notFound") };
  if (isDemoLogin(employee.login)) return { ok: false, error: t("password.errors.demo") };

  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(employee.auth_user_id, { password });
  if (error) return { ok: false, error: t("password.errors.save") };
  refresh();
  return { ok: true, data: { password } };
}

// Временный пароль: 4 буквы и 4 цифры, без похожих символов (l, o, 0, 1).
function temporaryPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  return Array.from({ length: 4 }, () => pick(letters)).join("") + Array.from({ length: 4 }, () => pick(digits)).join("");
}
