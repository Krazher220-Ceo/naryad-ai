"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/components/LocaleProvider";
import { Button, EmptyState, IconScan, InlineNotice, cx } from "@/components/ui";
import {
  REQUEST_QUEUE_EVENT,
  flushRequests,
  getDeviceId,
  pendingRequests,
  type PendingRequest,
} from "@/lib/requests/device";
import type { Enums } from "@/lib/supabase/database.types";

export type OperatorRequestItem = {
  id: string;
  number: number;
  created_at: string;
  status: Enums<"request_status">;
  description: string;
  dismiss_reason: string | null;
  equipment_name: string | null;
  section_name: string | null;
  order_number: number | null;
};

const TONE: Record<Enums<"request_status"> | "pending", string> = {
  new: "bg-info-soft text-info",
  converted: "bg-success-soft text-success",
  dismissed: "bg-danger-soft text-danger",
  pending: "bg-line text-ink",
};

// Список «Мои заявки» со статусами: ждёт мастера, выдан наряд №, отклонена с причиной, ждёт сети.
export function OperatorRequests({ initial, accountName }: { initial: OperatorRequestItem[] | null; accountName: string | null }) {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<OperatorRequestItem[]>(initial ?? []);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setPending(pendingRequests());
    if (initial) return; // вошедший оператор: список уже пришёл с сервера
    try {
      const res = await fetch(`/api/requests?device=${encodeURIComponent(getDeviceId())}`);
      const body = (await res.json()) as { ok: boolean; items?: OperatorRequestItem[] };
      if (body.ok) {
        setItems(body.items ?? []);
        setLoadError(false);
      } else setLoadError(true);
    } catch {
      setLoadError(true);
    }
  }, [initial]);

  // Появилась сеть — отправляем сохранённые заявки и обновляем список.
  const flush = useCallback(async () => {
    if (pendingRequests().length && navigator.onLine) await flushRequests();
    await load();
  }, [load]);

  useEffect(() => {
    const first = setTimeout(flush, 0);
    const onQueue = () => setPending(pendingRequests());
    window.addEventListener("online", flush);
    window.addEventListener(REQUEST_QUEUE_EVENT, onQueue);
    // Статус заявки меняет мастер: подтягиваем раз в 30 секунд, пока экран открыт.
    const timer = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", flush);
      window.removeEventListener(REQUEST_QUEUE_EVENT, onQueue);
    };
  }, [flush, load]);

  const time = (iso: string) =>
    new Date(iso).toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const statusText = (r: OperatorRequestItem) => {
    if (r.status === "converted") {
      return r.order_number ? t("opHome.status.converted").replace("{n}", String(r.order_number)) : t("opHome.status.convertedNoNumber");
    }
    if (r.status === "dismissed") return t("opHome.status.dismissed").replace("{reason}", r.dismiss_reason ?? "");
    return t("opHome.status.new");
  };

  return (
    <div className="flex flex-col gap-4">
      <InlineNotice tone={accountName ? "success" : "info"}>
        {accountName ? t("opHome.signedAs").replace("{name}", accountName) : t("opHome.guest")}
      </InlineNotice>

      <Link
        href="/operator/scan"
        className="flex min-h-[72px] items-center justify-center gap-3 rounded-2xl bg-danger px-5 text-xl font-bold text-white shadow-lg hover:bg-danger-hover"
      >
        <IconScan className="size-7" />
        {t("opHome.report")}
      </Link>

      {loadError && <InlineNotice tone="danger">{t("report.errors.load")}</InlineNotice>}

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          {pending.map((p) => (
            <article key={p.localId} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <b className="text-base text-ink">{p.place}</b>
                <span className={cx("rounded-lg px-2 py-1 text-sm font-bold", TONE.pending)}>{t("opHome.status.pending")}</span>
              </div>
              <p className="text-base text-ink">{p.description}</p>
            </article>
          ))}
          <Button variant="secondary" size="md" onClick={flush}>
            {t("opHome.retry")}
          </Button>
        </section>
      )}

      {items.length === 0 && pending.length === 0 && !loadError ? (
        <EmptyState title={t("opHome.emptyTitle")} text={t("opHome.emptyText")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-base text-ink">
                  №{r.number} · {r.equipment_name ?? r.section_name ?? ""}
                </b>
                <span className={cx("rounded-lg px-2 py-1 text-sm font-bold", TONE[r.status])}>{statusText(r)}</span>
              </div>
              <p className="text-base text-ink">{r.description}</p>
              <span className="text-sm text-ink-muted">{time(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
