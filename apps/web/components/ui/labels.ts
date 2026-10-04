import type { Translate } from "@/lib/i18n";
import type { WorkerState } from "./types";

// Подписи, которые нужны и серверным, и клиентским экранам. Перевод передаётся параметром:
// на сервере это await getT(), в браузере — useT().

// «2 ч 10 мин» или «45 мин».
export function formatMinutes(t: Translate, total: number): string {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return t("ui.time.minutes").replace("{m}", String(m));
  return t("ui.time.hours").replace("{h}", String(h)).replace("{m}", String(m));
}

// Подпись состояния: «Свободен», «Выполняет наряд №1042», «В очереди: 2», «Не на смене».
export function workerStateLabel(t: Translate, state: WorkerState, orderNumber?: string | number, queueCount?: number) {
  if (state === "busy" && orderNumber !== undefined) return `${t("workers.currentOrder")}${orderNumber}`;
  if (state === "queue" && queueCount !== undefined) return `${t("workers.queueCount")} ${queueCount}`;
  return t(`workers.status.${state}`);
}
