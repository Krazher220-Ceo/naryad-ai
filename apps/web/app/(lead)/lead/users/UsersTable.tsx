"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, ConfirmSheet, Sheet, useToast } from "@/components/ui";
import { resetEmployeePassword } from "@/lib/auth/password";
import type { Enums } from "@/lib/supabase/database.types";

type User = { id: string; login: string; full_name: string; role: Enums<"employee_role"> };

export function UsersTable({ users }: { users: User[] }) {
  const t = useT();
  const toast = useToast();
  const [target, setTarget] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);

  async function reset() {
    if (!target) return;
    setBusy(true);
    const res = await resetEmployeePassword(target.id).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setIssued({ name: target.full_name, password: res.data.password });
      setTarget(null);
    } else toast.show("error", { detail: res?.error });
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-base text-ink">{u.full_name}</b>
              <span className="text-sm text-ink-muted">
                {t(`roles.${u.role}`)} · {t("users.login")}: <span className="font-mono">{u.login}</span>
              </span>
            </span>
            <Button variant="secondary" size="md" onClick={() => setTarget(u)}>
              {t("users.reset")}
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmSheet
        open={target !== null}
        tone="danger"
        title={t("users.resetTitle").replace("{name}", target?.full_name ?? "")}
        description={t("users.resetHint")}
        confirmLabel={t("users.reset")}
        loading={busy}
        onConfirm={reset}
        onCancel={() => setTarget(null)}
      />

      <Sheet open={issued !== null} title={t("users.newPassword").replace("{name}", issued?.name ?? "")} onClose={() => setIssued(null)}>
        <p className="select-all rounded-xl bg-canvas p-4 text-center font-mono text-3xl font-bold tracking-wider text-ink">{issued?.password}</p>
        <Button fullWidth onClick={() => setIssued(null)}>
          {t("users.done")}
        </Button>
      </Sheet>
    </>
  );
}
