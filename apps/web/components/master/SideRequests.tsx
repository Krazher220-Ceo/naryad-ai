// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useT } from "@/components/LocaleProvider";
import { Card, ConfirmSheet, EmptyState, TextArea, cx, useToast } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { dismissRequest } from "@/lib/orders/actions";
import type { MasterBoard } from "@/lib/orders/queries";

// Заявки, которые ждут мастера (PLAN.md, раздел 8.5): операторов по QR и попутные находки
// исполнителей. «Выдать наряд» открывает форму, заполненную из заявки. «Отклонить» — только с причиной.

const REASONS = ["duplicate", "notFault", "planned", "other"] as const;
type Reason = (typeof REASONS)[number];

type Item = MasterBoard["requests"][number];

export function SideRequests({
  requests,
  showEmpty = false,
  limit,
}: {
  requests: MasterBoard["requests"];
  // На отдельной странице заявок пустой список объясняет, что сюда придёт.
  showEmpty?: boolean;
  // На панели смены показываем несколько, остальные — по ссылке «Все заявки».
  limit?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [dismissing, setDismissing] = useState<Item | null>(null);
  const [reason, setReason] = useState<Reason | "">("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);

  if (requests.length === 0) {
    return showEmpty ? <EmptyState title={t("requests.emptyTitle")} text={t("requests.emptyText")} /> : null;
  }
  const shown = limit ? requests.slice(0, limit) : requests;

  const reasonText = reason === "other" ? other.trim() : reason ? t(`requests.reason.${reason}` as MessageKey) : "";

  async function confirmDismiss() {
    if (!dismissing || !reasonText) return;
    setBusy(true);
    try {
      const res = await dismissRequest(dismissing.id, reasonText);
      if (res.ok) {
        toast.show("saved", { detail: t("requests.dismissed") });
        setDismissing(null);
      } else toast.show("error", { detail: res.error });
    } catch {
      toast.show("error");
    } finally {
      setBusy(false);
    }
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === "kk" ? "kk-KZ" : "ru-RU", { hour: "2-digit", minute: "2-digit" });

  // Кто сообщил: исполнитель по наряду, оператор с логином участка или оператор без входа.
  const who = (r: Item) => {
    if (r.parent) return t("requests.fromWorker").replace("{worker}", r.author?.full_name ?? "—").replace("{number}", String(r.parent.number));
    if (r.author) return t("requests.fromAccount").replace("{name}", r.author.full_name);
    return t("requests.fromOperator").replace("{name}", r.reporter_name ?? "—");
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-ink">{t("requests.titleCount").replace("{n}", String(requests.length))}</h2>
        {limit && requests.length > limit && (
          <Link href="/master/requests" className="text-base font-semibold text-brand underline-offset-4 hover:underline">
            {t("requests.openAll")}
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {shown.map((r) => (
          <li key={r.id}>
            <Card tone={r.machine_state === "stopped" ? "emergency" : "default"} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink-muted">
                  {t("requests.number").replace("{n}", String(r.number))} · {time(r.created_at)}
                </span>
                {r.machine_state && (
                  <span
                    className={cx(
                      "rounded-lg px-2 py-1 text-sm font-bold",
                      r.machine_state === "stopped" ? "bg-danger text-white" : "bg-warning-soft text-accent-ink",
                    )}
                  >
                    {r.machine_state === "stopped" ? t("requests.stateStopped") : t("requests.stateDefect")}
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold text-ink">{r.equipment?.name ?? `${r.section?.name ?? "—"} · ${t("requests.sectionWide")}`}</p>
              <p className="text-base text-ink">{r.description}</p>
              <p className="text-base text-ink-muted">{who(r)}</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/master/orders/new?request=${r.id}`}
                  className="inline-flex min-h-touch-sm items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white hover:bg-brand-hover"
                >
                  {t("requests.issue")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setDismissing(r);
                    setReason("");
                    setOther("");
                  }}
                  className="min-h-touch-sm rounded-xl border-2 border-ink bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas"
                >
                  {t("requests.dismiss")}
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmSheet
        open={dismissing !== null}
        tone="danger"
        title={t("requests.dismissTitle").replace("{n}", String(dismissing?.number ?? ""))}
        description={t("requests.dismissHint")}
        confirmLabel={t("requests.dismiss")}
        confirmDisabled={!reasonText}
        loading={busy}
        onConfirm={confirmDismiss}
        onCancel={() => setDismissing(null)}
      >
        <div role="radiogroup" aria-label={t("ui.reason.title")} className="flex flex-col gap-2">
          {REASONS.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={reason === code}
              onClick={() => setReason(code)}
              className={cx(
                "min-h-touch rounded-xl border-2 px-4 text-left text-lg font-semibold",
                reason === code ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink",
              )}
            >
              {t(`requests.reason.${code}` as MessageKey)}
            </button>
          ))}
          {reason === "other" && (
            <TextArea
              rows={2}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder={t("requests.otherPlaceholder")}
              aria-label={t("requests.otherPlaceholder")}
            />
          )}
        </div>
      </ConfirmSheet>
    </section>
  );
}
