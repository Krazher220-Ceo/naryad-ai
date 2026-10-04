"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { useT } from "@/components/LocaleProvider";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-1.5 text-base font-medium text-ink-muted">
        <span>{t("auth.login")}</span>
        <input
          name="login"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-14 min-h-14 w-full rounded-xl border border-line-strong bg-white px-4 text-lg text-ink shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-base font-medium text-ink-muted">
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
          className="h-14 min-h-14 w-full rounded-xl border border-line-strong bg-white px-4 text-lg tracking-widest text-ink shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-14 min-h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white shadow-sm hover:bg-brand-hover active:bg-[#001636] disabled:bg-line-strong disabled:opacity-50"
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
