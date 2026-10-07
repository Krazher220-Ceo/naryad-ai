// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { runDeadlineChecks } from "@/lib/orders/deadlines";

// Контроль сроков. Вызывается раз в минуту расписанием базы (pg_cron, миграция 0005).
// Доступ только с секретом CRON_SECRET в заголовке Authorization.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDeadlineChecks();
    return Response.json(result);
  } catch (e) {
    console.error("deadlines failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
