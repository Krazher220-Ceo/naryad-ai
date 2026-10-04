"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { Button, Card, Field, IconCheck, IconX, TextInput, cx, useToast } from "@/components/ui";
import { changePassword } from "@/lib/auth/password";
import { passwordProblems, type PasswordProblem } from "@/lib/auth/password-rules";

const RULES: PasswordProblem[] = ["length", "letter", "digit", "same"];

export function PasswordForm() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const problems = passwordProblems(next, current);
  const matches = next.length > 0 && next === repeat;
  const valid = current.length > 0 && problems.length === 0 && matches;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const res = await changePassword(current, next).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      toast.show("saved", { detail: t("password.saved") });
      router.push("/profile");
    } else {
      toast.show("error", { detail: res?.error, onRetry: save });
    }
  }

  const type = show ? "text" : "password";

  return (
    <Card className="flex flex-col gap-4">
      <Field label={t("password.current")} htmlFor="pw-current">
        <TextInput id="pw-current" type={type} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label={t("password.next")} htmlFor="pw-next">
        <TextInput id="pw-next" type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label={t("password.repeat")} htmlFor="pw-repeat">
        <TextInput id="pw-repeat" type={type} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
      </Field>
      <Button variant="secondary" size="md" onClick={() => setShow((v) => !v)} aria-pressed={show}>
        {show ? t("password.hide") : t("password.show")}
      </Button>

      {/* Правила проверяются на каждом нажатии клавиши */}
      <ul className="flex flex-col gap-1.5" aria-live="polite">
        {[...RULES.map((rule) => ({ key: rule, ok: next.length > 0 && !problems.includes(rule) })), { key: "match" as const, ok: matches }].map((r) => (
          <li key={r.key} className={cx("flex items-center gap-2 text-base font-semibold", r.ok ? "text-success" : "text-ink-muted")}>
            {r.ok ? <IconCheck className="size-5" /> : <IconX className="size-5" />}
            {t(`password.rules.${r.key}`)}
          </li>
        ))}
      </ul>

      <Button fullWidth disabled={!valid} loading={saving} onClick={save}>
        {t("password.save")}
      </Button>
    </Card>
  );
}
