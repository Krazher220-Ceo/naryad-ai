import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRating } from "@/lib/analytics/rating";
import { t } from "@/lib/i18n";
import type { WorkerBoardStatus } from "./types";

// Подбор исполнителя (п. 5.1.3 кейса): свободный, нужной специальности, с лучшим рейтингом.
// Считает код. Пояснение собирается из тех же фактов, по которым шёл выбор.
//
// Порядок: на смене → нужная специальность → свободен → меньше очередь → выше рейтинг за 30 дней.

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

export async function suggestWorkers(specialty: string | null, limit = 3): Promise<Candidate[]> {
  const supabase = await createClient();
  const [{ data: board }, rating] = await Promise.all([
    supabase.from("worker_board").select("id, full_name, specialty, board_status, queue_count, pending_count"),
    getRating(new Date(Date.now() - 30 * 24 * 3600_000), new Date()),
  ]);
  const ratingById = new Map(rating.filter((r) => !r.lowData).map((r) => [r.workerId, r.total]));

  const candidates = (board ?? [])
    .filter((w) => w.id && w.board_status !== "off")
    .map((w) => {
      const status = w.board_status as WorkerBoardStatus;
      const queue = (w.queue_count ?? 0) + (w.pending_count ?? 0);
      const score = ratingById.get(w.id!) ?? null;
      const fits = !specialty || w.specialty === specialty;
      const parts = [
        fits ? t("suggest.fitsSpecialty").replace("{specialty}", w.specialty ?? "—") : t("suggest.otherSpecialty"),
        t(`workers.status.${status}`).toLowerCase(),
        queue > 0 ? t("suggest.queue").replace("{n}", String(queue)) : t("suggest.noQueue"),
        score !== null ? t("suggest.rating").replace("{n}", String(score)) : t("suggest.noRating"),
      ];
      return { id: w.id!, fullName: w.full_name ?? "", specialty: w.specialty, boardStatus: status, queue, rating: score, fits, reason: parts.join(", ") };
    })
    .sort(
      (a, b) =>
        Number(b.fits) - Number(a.fits) ||
        STATUS_RANK[a.boardStatus] - STATUS_RANK[b.boardStatus] ||
        a.queue - b.queue ||
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
