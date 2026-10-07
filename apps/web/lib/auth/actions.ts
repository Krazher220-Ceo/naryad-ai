// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, loginToEmail, ROLE_HOME } from "@/lib/auth/roles";
import { getT } from "@/lib/i18n-server";

export type SignInState = { error: string | null };

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const t = await getT();
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (login === "" || password === "") {
    return { error: t("auth.errorEmpty") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login),
    password,
  });
  if (error) return { error: t("auth.errorInvalid") };

  // Пользователя берём из ответа входа: cookie этого запроса ещё старые.
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", data.user.id)
    .single();
  if (!employee || !isRole(employee.role)) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: t("auth.errorNoProfile") };
  }

  // Только адрес внутри приложения («/…», но не «//чужой-сайт»), иначе — на экран роли.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : ROLE_HOME[employee.role]);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Только этот браузер: демо-логины общие, глобальный выход выкидывал бы всех.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
