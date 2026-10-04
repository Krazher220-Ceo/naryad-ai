"use client";

import { useT } from "@/components/LocaleProvider";
import { cx } from "./cx";
import { workerStateLabel } from "./labels";
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

type WorkerChipProps = {
  name: string;
  state: WorkerState;
  orderNumber?: string | number;
  queueCount?: number;
};

// Исполнитель с цветом и подписью состояния. Не на смене — приглушён, но текст остаётся тёмным.
export function WorkerChip({ name, state, orderNumber, queueCount }: WorkerChipProps) {
  const t = useT();
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
        <span className="text-base text-ink-muted">{workerStateLabel(t, state, orderNumber, queueCount)}</span>
      </div>
    </div>
  );
}
