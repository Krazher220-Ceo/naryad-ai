// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use server";

import { refresh } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { isReportKind, isValidScope, recompute } from "./cached";
import { snapshotAgeMin } from "./snapshots";

// Кнопка «Обновить сейчас»: пересчитывает один отчёт вне расписания.
// Права проверяются здесь, на сервере: только мастер и руководитель.
// Защита от частых нажатий: не чаще раза в 5 минут на один отчёт (по времени снимка в базе).

const MIN_INTERVAL_MIN = 5;

export async function refreshReport(kind: string, scope: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT();
  const employee = await getCurrentEmployee();
  if (!employee || (employee.role !== "master" && employee.role !== "lead")) {
    return { ok: false, error: t("reportCache.refreshFailed") };
  }
  if (!isReportKind(kind) || !isValidScope(kind, scope)) return { ok: false, error: t("reportCache.refreshFailed") };

  const age = await snapshotAgeMin(kind, scope);
  if (age !== null && age < MIN_INTERVAL_MIN) {
    const wait = Math.max(1, Math.ceil(MIN_INTERVAL_MIN - age));
    return { ok: false, error: t("reportCache.tooOften").replace("{min}", String(wait)) };
  }

  try {
    await recompute(kind, scope);
  } catch (e) {
    console.error("refreshReport failed", kind, scope, e);
    return { ok: false, error: t("reportCache.refreshFailed") };
  }
  refresh();
  return { ok: true };
}
