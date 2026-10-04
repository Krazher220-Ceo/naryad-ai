"use client";

import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { cx } from "./cx";
import { IconAlert } from "./icons";
import type { Priority } from "./types";

const priorityClass: Record<Priority, string> = {
  emergency: "bg-prio-emergency",
  high: "bg-prio-high",
  normal: "bg-prio-normal",
  planned: "bg-prio-planned",
};

// Приоритет: сплошная заливка, белый текст. У аварийного ещё и значок.
export function PriorityBadge({ priority }: { priority: Priority }) {
  const t = useT();
  return (
    <span
      className={cx(
        "inline-flex min-h-8 whitespace-nowrap items-center gap-1 rounded-lg px-2.5 text-base font-bold text-white",
        priorityClass[priority],
      )}
    >
      {priority === "emergency" && <IconAlert className="size-5" />}
      {t(`orders.priority.${priority}` as MessageKey)}
    </span>
  );
}
