// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { Button, Sheet, cx } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { useConnection, type ConnectionStatus } from "@/lib/offline/ConnectionProvider";

// Плашка связи. На телефоне — маленькая в шапке, на ПК — на всю ширину в блоке аккаунта.
// Нажатие открывает очередь отправки.

const PILL: Record<ConnectionStatus, { box: string; dot: string }> = {
  online: { box: "bg-success-soft text-success", dot: "bg-success" },
  sending: { box: "bg-info-soft text-info", dot: "bg-info" },
  offline: { box: "bg-line text-ink", dot: "bg-line-strong" },
  error: { box: "bg-danger-soft text-danger", dot: "bg-danger" },
};

function useLabel(): string {
  const t = useT();
  const { status, pending, failed } = useConnection();
  if (status === "online") return t("conn.online");
  if (status === "error") return t("conn.error").replace("{n}", String(failed.length));
  if (status === "offline") {
    return pending.length ? t("conn.offline").replace("{n}", String(pending.length)) : t("conn.offlineZero");
  }
  return t("conn.sending").replace("{n}", String(Math.max(pending.length, 1)));
}

export function ConnectionPill({ wide = false }: { wide?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const connection = useConnection();
  const label = useLabel();
  const [open, setOpen] = useState(false);
  const style = PILL[connection.status];

  const time = (d: Date) =>
    d.toLocaleTimeString(locale === "kk" ? "kk-KZ" : "ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cx(
          "inline-flex items-center gap-2 rounded-full font-bold",
          wide ? "min-h-touch-sm w-full rounded-xl px-3 py-2 text-left text-sm" : "h-9 px-3 text-sm",
          style.box,
        )}
      >
        <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", style.dot)} />
        <span className="flex flex-1 flex-col leading-tight">
          <span>{label}</span>
          {wide && connection.status === "online" && (
            <span className="text-xs font-semibold">
              {t("conn.onlineHint")}
              {connection.syncedAt ? ` · ${time(connection.syncedAt)}` : ""}
            </span>
          )}
        </span>
      </button>

      <Sheet open={open} title={t("conn.sheetTitle")} onClose={() => setOpen(false)}>
        {connection.status === "offline" && <p className="text-base text-ink-muted">{t("conn.offlineHint")}</p>}

        {connection.failed.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-lg font-bold text-danger">{t("conn.failedTitle")}</h3>
            <ul className="flex flex-col gap-2">
              {connection.failed.map((error, i) => (
                <li key={i} className="rounded-xl border-l-8 border-danger bg-danger-soft p-3 text-base font-semibold">
                  {error}
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={connection.clearFailed}>
              {t("conn.clearErrors")}
            </Button>
          </section>
        )}

        {connection.pending.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {connection.pending.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
              >
                <span className="text-base font-semibold">
                  {item.kind === "transition"
                    ? t(`orders.action.${item.input.action}` as MessageKey)
                    : t(`conn.kind.${item.kind}` as MessageKey)}
                </span>
                <span className="text-sm text-ink-muted">
                  {t("conn.queuedAt").replace("{time}", time(new Date(item.queuedAt)))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          connection.failed.length === 0 && <p className="text-base text-ink-muted">{t("conn.empty")}</p>
        )}

        {connection.pending.length > 0 && (
          <Button fullWidth disabled={connection.status === "offline"} onClick={connection.retry}>
            {t("conn.retry")}
          </Button>
        )}
      </Sheet>
    </>
  );
}
