import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { OrderRow } from "@/components/master/OrderRow";
import { BottomActionBar, EmptyState, WorkerChip, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
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
        "flex flex-col gap-1 rounded-2xl border-2 p-4",
        red ? "border-danger bg-danger-soft" : "border-line bg-surface",
      )}
    >
      <span className={cx("text-3xl font-bold", red ? "text-danger" : "text-ink")}>{value}</span>
      <span className="text-base font-semibold text-ink">{label}</span>
    </div>
  );
}

export default async function MasterPage() {
  const employee = await requireRole("master");
  const { workers, orders } = await getMasterBoard();

  const count = (statuses: OrderStatus[]) => orders.filter((o) => statuses.includes(o.status)).length;
  const sortedWorkers = [...workers].sort((a, b) => WORKER_RANK[a.board_status] - WORKER_RANK[b.board_status]);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <RealtimeRefresh />
      <AppHeader fullName={employee.fullName} roleLabel={t("roles.master")} />
      <TelegramLinkCard />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 pb-36 lg:max-w-6xl">
        <div className="grid grid-cols-2 gap-2 lg:max-w-md">
          {(
            [
              ["/master/shift", "shiftReport.title"],
              ["/master/rating", "rating.linkShort"],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-touch items-center justify-center rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-semibold text-ink hover:bg-canvas"
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

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <section className="flex min-w-0 flex-col gap-3 lg:w-72 lg:shrink-0">
            <h2 className="text-xl font-bold text-ink">{t("master.workersTitle")}</h2>
            {sortedWorkers.length === 0 ? (
              <EmptyState title={t("ui.empty.workersTitle")} text={t("ui.empty.workersText")} />
            ) : (
              // На телефоне ряд прокручивается внутри себя, на ноутбуке это колонка
              <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                {sortedWorkers.map((w) => (
                  <li key={w.id} className="w-60 shrink-0 lg:w-auto">
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

          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">{t("master.ordersTitle")}</h2>
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
                <div className="hidden grid-cols-4 items-start gap-3 lg:grid">
                  {COLUMNS.map((col) => (
                    <div key={col.key} className="flex min-w-0 flex-col gap-3">
                      <h3 className="text-lg font-bold text-ink-muted">{t(`master.columns.${col.key}`)}</h3>
                      {orders
                        .filter((o) => col.statuses.includes(o.status))
                        .map((o) => (
                          <OrderRow key={o.id} order={o} />
                        ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <BottomActionBar>
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
