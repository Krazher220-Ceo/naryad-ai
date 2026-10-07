// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui";
import { refreshReport } from "@/lib/analytics/actions";

// Время по Костанаю (UTC+5), «03.10.2026 14:05». Считаем вручную: одинаково на сервере и в браузере.
function formatLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)} ${d.slice(11, 16)}`;
}

// Строка «Обновлено: ...» и кнопка «Обновить сейчас» под заголовком кэшируемого отчёта.
// Нет времени (кэш не работает) — строка не показывается.
export function SnapshotBar({ kind, scope, computedAt }: { kind: string; scope: string; computedAt: string | null }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!computedAt) return null;

  function onClick() {
    setError(null);
    start(async () => {
      try {
        const res = await refreshReport(kind, scope);
        if (!res.ok) setError(res.error);
      } catch {
        setError(t("reportCache.refreshFailed"));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm text-ink-muted">{t("reportCache.updatedAt").replace("{date}", formatLocal(computedAt))}</p>
      <Button variant="ghost" size="md" onClick={onClick} loading={pending} disabled={pending}>
        {pending ? t("reportCache.refreshing") : t("reportCache.refreshNow")}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
