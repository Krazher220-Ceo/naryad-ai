"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { t } from "@/lib/i18n";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span>{t("auth.login")}</span>
        <input
          name="login"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="min-h-14 rounded border px-3 text-lg"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>
          {t("auth.pin")} ({t("auth.pinHint")})
        </span>
        <input
          name="pin"
          type="password"
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="current-password"
          className="min-h-14 rounded border px-3 text-lg"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 w-full rounded bg-black text-lg font-semibold text-white disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("auth.submit")}
      </button>
      {state.error && (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
