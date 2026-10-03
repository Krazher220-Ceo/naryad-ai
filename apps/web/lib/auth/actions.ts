"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { loginToEmail, ROLE_HOME } from "@/lib/auth/roles";
import { t } from "@/lib/i18n";

export type SignInState = { error: string | null };

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const login = String(formData.get("login") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (login === "" || !/^\d{6}$/.test(pin)) {
    return { error: t("auth.errorPinFormat") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login),
    password: pin,
  });
  if (error) return { error: t("auth.errorInvalid") };

  const employee = await getCurrentEmployee();
  if (!employee) {
    await supabase.auth.signOut();
    return { error: t("auth.errorNoProfile") };
  }

  redirect(ROLE_HOME[employee.role]);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
