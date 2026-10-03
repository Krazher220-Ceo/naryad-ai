"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { t } from "@/lib/i18n";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-1.5 text-base font-medium text-slate-700">
        <span>{t("auth.login")}</span>
        <input
          name="login"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-14 min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-base font-medium text-slate-700">
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
          className="h-14 min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg tracking-widest text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-14 min-h-14 w-full rounded-xl bg-slate-900 text-lg font-semibold text-white shadow-sm hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-400 disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("auth.submit")}
      </button>
      {state.error && (
        <p role="alert" className="text-center text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
