import { t } from "@/lib/i18n";
import { cx } from "./cx";
import type { WorkerState } from "./types";

const dotClass: Record<WorkerState, string> = {
  free: "bg-worker-free",
  busy: "bg-worker-busy",
  queue: "bg-worker-queue",
  off: "bg-worker-off",
};

// Цветная точка состояния. Рамка нужна, чтобы жёлтая точка была видна на белом.
export function WorkerStatusDot({ state, className }: { state: WorkerState; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block size-4 shrink-0 rounded-full ring-2 ring-ink/30", dotClass[state], className)}
    />
  );
}

// Подпись состояния: «Свободен», «Выполняет наряд №1042», «В очереди: 2», «Не на смене».
export function workerStateLabel(state: WorkerState, orderNumber?: string | number, queueCount?: number) {
  if (state === "busy" && orderNumber !== undefined) return `${t("workers.currentOrder")}${orderNumber}`;
  if (state === "queue" && queueCount !== undefined) return `${t("workers.queueCount")} ${queueCount}`;
  return t(`workers.status.${state}`);
}

type WorkerChipProps = {
  name: string;
  state: WorkerState;
  orderNumber?: string | number;
  queueCount?: number;
};

// Исполнитель с цветом и подписью состояния. Не на смене — приглушён, но текст остаётся тёмным.
export function WorkerChip({ name, state, orderNumber, queueCount }: WorkerChipProps) {
  return (
    <div
      className={cx(
        "flex min-h-touch items-center gap-3 rounded-xl border border-line px-3 py-2",
        state === "off" ? "bg-canvas" : "bg-surface",
      )}
    >
      <WorkerStatusDot state={state} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-base font-semibold text-ink">{name}</span>
        <span className="text-base text-ink-muted">{workerStateLabel(state, orderNumber, queueCount)}</span>
      </div>
    </div>
  );
}
