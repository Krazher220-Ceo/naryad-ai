// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, Card, ConfirmSheet, Field, Select, Sheet, TextInput, useToast } from "@/components/ui";
import { resetEmployeePassword } from "@/lib/auth/password";
import { ROLES, type Role } from "@/lib/auth/roles";
import { addEmployee, changeEmployeeRole } from "@/lib/auth/users";
import type { Enums } from "@/lib/supabase/database.types";

type User = { id: string; login: string; full_name: string; role: Enums<"employee_role"> };

export function UsersTable({ users }: { users: User[] }) {
  const t = useT();
  const toast = useToast();
  const [target, setTarget] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);
  const [filter, setFilter] = useState<Role | "all">("all");
  const [login, setLogin] = useState("");
  const [fullName, setFullName] = useState("");
  const [newRole, setNewRole] = useState<Role>("worker");
  const [adding, setAdding] = useState(false);

  async function add() {
    setAdding(true);
    const res = await addEmployee({ login, fullName, role: newRole }).catch(() => null);
    setAdding(false);
    if (res?.ok) {
      setIssued({ name: fullName, password: res.data.password });
      setLogin("");
      setFullName("");
    } else toast.show("error", { detail: res?.error });
  }

  async function changeRole(u: User, role: Role) {
    const res = await changeEmployeeRole(u.id, role).catch(() => null);
    if (res?.ok) toast.show("saved");
    else toast.show("error", { detail: res?.error });
  }

  const shown = filter === "all" ? users : users.filter((u) => u.role === filter);
  const roleOptions = ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }));

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
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">{t("users.add")}</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label={t("users.login")} htmlFor="new-login">
            <TextInput id="new-login" value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" placeholder="ivanov1" />
          </Field>
          <Field label={t("users.fullName")} htmlFor="new-name">
            <TextInput id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("report.whoPlaceholder")} />
          </Field>
          <Field label={t("users.role")} htmlFor="new-role">
            <Select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} options={roleOptions} />
          </Field>
        </div>
        <Button loading={adding} disabled={!login.trim() || !fullName.trim()} onClick={add}>
          {t("users.addButton")}
        </Button>
      </Card>

      <div role="group" aria-label={t("users.role")} className="flex flex-wrap gap-2">
        {(["all", ...ROLES] as const).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={filter === r}
            onClick={() => setFilter(r)}
            className={
              filter === r
                ? "min-h-touch-sm rounded-xl bg-brand px-4 text-base font-bold text-white"
                : "min-h-touch-sm rounded-xl border-2 border-line-strong bg-surface px-4 text-base font-semibold text-ink"
            }
          >
            {r === "all" ? t("users.all") : t(`roles.${r}`)}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-base text-ink">{u.full_name}</b>
              <span className="text-sm text-ink-muted">
                {t("users.login")}: <span className="font-mono">{u.login}</span>
              </span>
            </span>
            <Select
              aria-label={t("users.role")}
              value={u.role}
              onChange={(e) => changeRole(u, e.target.value as Role)}
              options={roleOptions}
              className="w-auto"
            />
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
