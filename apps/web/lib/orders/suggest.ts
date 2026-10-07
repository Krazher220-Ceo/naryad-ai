// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRating } from "@/lib/analytics/rating";
import { getT } from "@/lib/i18n-server";
import type { WorkerBoardStatus } from "./types";

// Подбор исполнителя (п. 5.1.3 кейса): свободный, нужной специальности, с лучшим рейтингом.
// Считает код. Пояснение собирается из тех же фактов, по которым шёл выбор.
//
// Порядок: на смене → нужная специальность → есть допуск → свободен → меньше нагрузка в нормо-часах
// → выше рейтинг за 30 дней.

export type Candidate = {
  id: string;
  fullName: string;
  specialty: string | null;
  boardStatus: WorkerBoardStatus;
  queue: number;
  rating: number | null;
  reason: string;
};

const STATUS_RANK: Record<WorkerBoardStatus, number> = { free: 0, busy: 1, queue: 2, off: 3 };

// Какой допуск нужен для работ по категории шифра. Остальные категории допуска не требуют.
export const PERMIT_BY_CATEGORY: Record<string, string> = {
  Э: "электробезопасность",
  Г: "работа под давлением",
};

// Норматив по умолчанию, если у открытого наряда ещё нет шифра.
const DEFAULT_NORM_HOURS = 2;

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

export async function suggestWorkers(specialty: string | null, category: string | null = null, limit = 3): Promise<Candidate[]> {
  const t = await getT();
  const supabase = await createClient();
  const [{ data: board }, { data: people }, { data: open }, rating] = await Promise.all([
    supabase.from("worker_board").select("id, full_name, specialty, board_status, queue_count, pending_count"),
    supabase.from("employees").select("id, permits").eq("role", "worker"),
    // Баланс нагрузки: сумма нормативов открытых нарядов на каждом исполнителе.
    supabase
      .from("work_orders")
      .select("assignee_id, fault:fault_code ( norm_hours )")
      .not("assignee_id", "is", null)
      .not("status", "in", "(closed,cancelled,done,ai_review,rejected)"),
    getRating(new Date(Date.now() - 30 * 24 * 3600_000), new Date()),
  ]);
  const ratingById = new Map(rating.filter((r) => !r.lowData).map((r) => [r.workerId, r.total]));
  const permitsById = new Map((people ?? []).map((p) => [p.id, p.permits]));
  const loadById = new Map<string, number>();
  for (const o of open ?? []) {
    const hours = Number(o.fault?.norm_hours ?? DEFAULT_NORM_HOURS);
    loadById.set(o.assignee_id!, (loadById.get(o.assignee_id!) ?? 0) + hours);
  }
  const permit = category ? (PERMIT_BY_CATEGORY[category] ?? null) : null;

  const candidates = (board ?? [])
    .filter((w) => w.id && w.board_status !== "off")
    .map((w) => {
      const status = w.board_status as WorkerBoardStatus;
      const queue = (w.queue_count ?? 0) + (w.pending_count ?? 0);
      const load = loadById.get(w.id!) ?? 0;
      const score = ratingById.get(w.id!) ?? null;
      const fits = !specialty || w.specialty === specialty;
      const hasPermit = !permit || (permitsById.get(w.id!) ?? []).includes(permit);
      const parts = [
        fits ? t("suggest.fitsSpecialty").replace("{specialty}", w.specialty ?? "—") : t("suggest.otherSpecialty"),
        ...(permit ? [(hasPermit ? t("suggest.hasPermit") : t("suggest.noPermit")).replace("{permit}", permit)] : []),
        t(`workers.status.${status}`).toLowerCase(),
        queue > 0 ? t("suggest.queue").replace("{n}", String(queue)) : t("suggest.noQueue"),
        load > 0 ? t("suggest.load").replace("{h}", oneDecimal(load)) : t("suggest.noLoad"),
        score !== null ? t("suggest.rating").replace("{n}", String(score)) : t("suggest.noRating"),
      ];
      return { id: w.id!, fullName: w.full_name ?? "", specialty: w.specialty, boardStatus: status, queue, load, rating: score, fits, hasPermit, reason: parts.join(", ") };
    })
    .sort(
      (a, b) =>
        Number(b.fits) - Number(a.fits) ||
        Number(b.hasPermit) - Number(a.hasPermit) ||
        STATUS_RANK[a.boardStatus] - STATUS_RANK[b.boardStatus] ||
        a.load - b.load ||
        (b.rating ?? 0) - (a.rating ?? 0),
    );

  return candidates.slice(0, limit).map((c) => ({
    id: c.id,
    fullName: c.fullName,
    specialty: c.specialty,
    boardStatus: c.boardStatus,
    queue: c.queue,
    rating: c.rating,
    reason: c.reason,
  }));
}
