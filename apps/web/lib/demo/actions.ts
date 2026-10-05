"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearSnapshots } from "@/lib/analytics/snapshots";
import { getT } from "@/lib/i18n-server";

// «Сбросить демо» (страница для жюри /demo). Возвращает наряды к снимку демо-данных
// и сдвигает даты так, чтобы история заканчивалась сегодня (миграция 0009, restore_demo).
// Справочники и учётные записи не меняются.
//
// Доступно без входа: жюри проверяет по ссылке само. Чтобы кнопку не нажимали подряд,
// сброс не чаще раза в минуту.

let lastResetAt = 0;
const COOLDOWN_MS = 60_000;

export async function resetDemo(): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT();
  if (Date.now() - lastResetAt < COOLDOWN_MS) return { ok: false, error: t("demo.resetTooOften") };
  lastResetAt = Date.now();

  const { error } = await createAdminClient().rpc("restore_demo");
  if (error) {
    console.error("restore_demo failed", error);
    return { ok: false, error: t("demo.resetFailed") };
  }
  // Цифры отчётов изменились: кэшированные снимки пересчитаются при следующем открытии.
  await clearSnapshots();
  refresh();
  return { ok: true };
}
