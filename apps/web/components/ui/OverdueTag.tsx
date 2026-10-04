"use client";

import { useT } from "@/components/LocaleProvider";
import { IconClock } from "./icons";
import { formatMinutes } from "./labels";

// Просрочка — вычисляемый признак, не статус. Считает её lib/orders, сюда приходит готовое число минут.
// Если минут нет или их 0, метка не показывается.
export function OverdueTag({ minutesLate }: { minutesLate: number | null | undefined }) {
  const t = useT();
  if (!minutesLate || minutesLate <= 0) return null;
  return (
    <span className="inline-flex min-h-8 whitespace-nowrap items-center gap-1 rounded-lg border-2 border-danger bg-danger-soft px-2 text-base font-bold text-danger">
      <IconClock className="size-5" />
      {t("ui.overdueBy").replace("{time}", formatMinutes(t, minutesLate))}
    </span>
  );
}
