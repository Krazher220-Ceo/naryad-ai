// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import Link from "next/link";
import { PushBanner } from "@/components/PushControl";
import { Suspense } from "react";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { OrderCard, OrderRow } from "@/components/master/OrderRow";
import { SideRequests } from "@/components/master/SideRequests";
import { BottomActionBar, EmptyState, WorkerChip, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { getMasterBoard } from "@/lib/orders/queries";
import { RealtimeRefresh } from "@/lib/orders/RealtimeRefresh";
import type { OrderStatus, WorkerBoardStatus } from "@/lib/orders/types";

// Сначала свободные, потом занятые, с очередью и не на смене.
const WORKER_RANK: Record<WorkerBoardStatus, number> = { free: 0, busy: 1, queue: 2, off: 3 };

// Колонки доски на ноутбуке. Остальные статусы (например «Отклонён») попадают в первую.
const COLUMNS: { key: "issued" | "inWork" | "paused" | "review"; statuses: OrderStatus[] }[] = [
  { key: "issued", statuses: ["issued", "queued", "accepted", "rejected"] },
  { key: "inWork", statuses: ["in_progress", "rework"] },
  { key: "paused", statuses: ["paused"] },
  { key: "review", statuses: ["done", "ai_review"] },
];

function Tile({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  const red = alert && value > 0;
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-2xl border-2 p-4 lg:flex-row lg:items-center lg:gap-3 lg:rounded-xl lg:px-3 lg:py-2",
        red ? "border-danger bg-danger-soft" : "border-line bg-surface",
      )}
    >
      <span className={cx("text-3xl font-bold lg:text-2xl", red ? "text-danger" : "text-ink")}>{value}</span>
      <span className="text-base font-semibold text-ink lg:text-sm">{label}</span>
    </div>
  );
}

export default async function MasterPage() {
  const t = await getT();
  await requireRole("master");
  const { workers, orders, requests } = await getMasterBoard();

  const count = (statuses: OrderStatus[]) => orders.filter((o) => statuses.includes(o.status)).length;
  const sortedWorkers = [...workers].sort((a, b) => WORKER_RANK[a.board_status] - WORKER_RANK[b.board_status]);

  return (
    <div className="flex flex-1 flex-col bg-canvas lg:h-dvh lg:flex-none lg:overflow-hidden">
      <RealtimeRefresh />
      {/* Карточка догружается потоком и не задерживает основной экран */}
      <Suspense fallback={null}>
        <TelegramLinkCard />
      </Suspense>
      <PushBanner />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 pb-36 lg:min-h-0 lg:max-w-none lg:gap-3 lg:px-4 lg:py-3 lg:pb-3">
        <div className="flex flex-wrap gap-2 lg:hidden">
          {(
            [
              ["/master/shift", "shiftReport.title"],
              ["/master/rating", "rating.linkShort"],
              ["/master/anomalies", "anomalies.linkShort"],
              ["/master/assistant", "assistant.link"],
              ["/master/equipment/qr", "equipmentQr.link"],
              ["/master/settings", "settings.title"],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-touch flex-1 basis-[calc(50%-0.5rem)] items-center justify-center rounded-xl border-2 border-line-strong bg-surface px-3 text-center text-base font-semibold text-ink hover:bg-canvas sm:basis-auto"
            >
              {t(label)}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={t("master.counters.emergency")} value={orders.filter((o) => o.priority === "emergency").length} alert />
          <Tile label={t("master.counters.overdue")} value={orders.filter((o) => o.overdue).length} alert />
          <Tile label={t("master.counters.inWork")} value={count(["in_progress", "paused"])} />
          <Tile label={t("master.counters.waiting")} value={count(["issued", "queued"])} />
        </div>

        <SideRequests requests={requests} limit={4} />

        <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-4">
          <section className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:w-56 lg:shrink-0 lg:gap-2">
            <h2 className="text-xl font-bold text-ink lg:text-base">{t("master.workersTitle")}</h2>
            {sortedWorkers.length === 0 ? (
              <EmptyState title={t("ui.empty.workersTitle")} text={t("ui.empty.workersText")} />
            ) : (
              // На телефоне ряд прокручивается внутри себя, на ноутбуке это колонка
              <ul className="flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1.5 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
                {sortedWorkers.map((w) => (
                  <li key={w.id} className="w-60 shrink-0 lg:w-auto lg:[&>div]:min-h-0 lg:[&>div]:py-1 lg:[&_span]:text-sm">
                    <WorkerChip
                      name={w.full_name ?? ""}
                      state={w.board_status}
                      orderNumber={w.current_order_number ?? undefined}
                      queueCount={w.queue_count ?? undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex min-w-0 flex-1 flex-col gap-3 lg:min-h-0 lg:gap-2">
            <h2 className="text-xl font-bold text-ink lg:text-base">{t("master.ordersTitle")}</h2>
            {orders.length === 0 ? (
              <EmptyState title={t("master.noOrdersTitle")} text={t("master.noOrdersText")} />
            ) : (
              <>
                {/* Телефон: один список, аварийные и просроченные уже наверху */}
                <ul className="flex flex-col gap-3 lg:hidden">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <OrderRow order={o} />
                    </li>
                  ))}
                </ul>
                {/* Ноутбук: колонки по статусам */}
                <div className="hidden min-h-0 flex-1 grid-cols-[repeat(4,minmax(0,1fr))] gap-3 lg:grid">
                  {COLUMNS.map((col) => (
                    <div key={col.key} className="flex min-h-0 min-w-0 flex-col gap-2">
                      <h3 className="text-sm font-bold text-ink-muted">{t(`master.columns.${col.key}`)}</h3>
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                        {orders
                          .filter((o) => col.statuses.includes(o.status))
                          // Аварийные сверху, остальной порядок сохраняется
                          .sort((x, y) => Number(y.priority === "emergency") - Number(x.priority === "emergency"))
                          .map((o) => (
                            <OrderCard key={o.id} order={o} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <BottomActionBar className="lg:hidden">
        <Link
          href="/master/orders/new"
          className="inline-flex min-h-touch w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-hover active:bg-black"
        >
          {t("master.issueOrder")}
        </Link>
      </BottomActionBar>
    </div>
  );
}
