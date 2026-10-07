// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import type { NextRequest } from "next/server";
import { currentShift } from "@/lib/analytics/shift";
import { getCurrentEmployee } from "@/lib/auth/session";
import { tRu as t } from "@/lib/i18n";
import { BUILDERS, isReportName, type ReportParams } from "../_build";
import { renderPdf } from "../_pdf";
import { renderXlsx } from "../_xlsx";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const fail = (key: "unauthorized" | "unknownReport" | "badParams" | "failed", status: number) =>
  Response.json({ error: t(`export.${key}`) }, { status });

// Разбор параметров: неверное значение даёт null, а не молчаливую подмену.
function parseParams(search: URLSearchParams): ReportParams | null {
  const daysRaw = search.get("days");
  const days = daysRaw === null ? 30 : Number(daysRaw);
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;

  const now = currentShift();
  const date = search.get("date") ?? now.date;
  const shift = search.get("shift") ?? now.shift;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) return null;
  if (shift !== "A" && shift !== "B") return null;
  return { days, date, shift };
}

// Префикс /api открыт для прокси, поэтому роль проверяем здесь сами.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[report]">) {
  const employee = await getCurrentEmployee();
  if (!employee || (employee.role !== "master" && employee.role !== "lead")) return fail("unauthorized", 401);

  const { report } = await ctx.params;
  if (!isReportName(report)) return fail("unknownReport", 404);

  const search = request.nextUrl.searchParams;
  const format = search.get("format");
  const params = parseParams(search);
  if ((format !== "xlsx" && format !== "pdf") || !params) return fail("badParams", 400);

  try {
    const doc = await BUILDERS[report](params);
    const body = format === "xlsx" ? await renderXlsx(doc) : await renderPdf(doc);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": format === "xlsx" ? XLSX_TYPE : "application/pdf",
        "Content-Disposition": `attachment; filename="${doc.fileName}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export failed", report, e);
    return fail("failed", 500);
  }
}
