import { t } from "@/lib/i18n";
import { IconClock } from "./icons";

// «2 ч 10 мин» или «45 мин».
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return t("ui.time.minutes").replace("{m}", String(m));
  return t("ui.time.hours").replace("{h}", String(h)).replace("{m}", String(m));
}

// Просрочка — вычисляемый признак, не статус. Считает её lib/orders, сюда приходит готовое число минут.
// Если минут нет или их 0, метка не показывается.
export function OverdueTag({ minutesLate }: { minutesLate: number | null | undefined }) {
  if (!minutesLate || minutesLate <= 0) return null;
  return (
    <span className="inline-flex min-h-8 whitespace-nowrap items-center gap-1 rounded-lg border-2 border-danger bg-danger-soft px-2 text-base font-bold text-danger">
      <IconClock className="size-5" />
      {t("ui.overdueBy").replace("{time}", formatMinutes(minutesLate))}
    </span>
  );
}
