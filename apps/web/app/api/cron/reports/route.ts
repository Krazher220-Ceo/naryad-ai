// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { refreshAllSnapshots } from "@/lib/analytics/cached";

// Ночной пересчёт отчётов и текстов ИИ в report_snapshots. Расписание — apps/web/vercel.json
// (01:00 UTC, около 06:00 в Костанае). Vercel сам добавляет заголовок Authorization: Bearer <CRON_SECRET>.
// Модель на каждую аномалию может отвечать до 30 секунд, поэтому лимит времени увеличен.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await refreshAllSnapshots();
    return Response.json({ ok: results.every((r) => r.ok), results });
  } catch (e) {
    console.error("reports cron failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
