// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Проверка прогноза на выдуманных данных. Запуск: cd apps/web && npx tsx ../../scripts/analytics/forecast-sanity.ts
import { computeForecast } from "../../apps/web/lib/analytics/forecast";
import type { HistoryOrder } from "../../apps/web/lib/analytics/history";
import { benjaminiHochberg, modifiedZ, poissonTail } from "../../apps/web/lib/analytics/stats";

const DAY = 86400_000;
const to = new Date("2026-10-07T12:00:00Z");
const from = new Date(to.getTime() - 90 * DAY);

let n = 0;
function failures(id: string, name: string, daysAgo: number[]): HistoryOrder[] {
  return daysAgo.map((d) => ({
    id: `o${n++}`,
    number: n,
    type: "unplanned",
    status: "closed",
    priority: "normal",
    fault_code: "М-02",
    created_at: new Date(to.getTime() - d * DAY).toISOString(),
    accepted_at: null,
    started_at: null,
    done_at: null,
    due_at: "",
    assignee_id: null,
    equipment: { id, name, type: "conveyor" },
    section: { id: "s1", name: "Участок" },
    assignee: null,
  }));
}

const orders = [
  // хронический: 20 отказов за 90 дней, ровно
  ...failures("a", "Хронический", Array.from({ length: 20 }, (_, i) => 2 + i * 4.4)),
  // участившийся: 2 в первые 60 дней, 5 за последние 30
  ...failures("b", "Участившийся", [80, 50, 3, 7, 12, 18, 25]),
  // один отказ: не должен давать абсурд
  ...failures("c", "Один отказ", [40]),
  // фон: 6 машин по 3 отказа
  ...["d", "e", "f", "g", "h", "i"].flatMap((id, k) => failures(id, `Фон ${id}`, [10 + k, 40 + k, 70 + k])),
];

const r = computeForecast(orders, from, to);
console.log("MTBF завода, дн:", r.fleetMtbfDays);
for (const i of r.items) {
  console.log(
    i.name.padEnd(14),
    `n=${i.failures90d}`.padEnd(6),
    `mtbf=${i.mtbfDays}`.padEnd(10),
    `p1=${(i.p1 * 100).toFixed(0)}%`.padEnd(8),
    `rr=${i.rr}`.padEnd(8), `trend=${i.trendFactor}`.padEnd(10),
    `30д=${i.failures30}/${i.expected30} q=${i.qValue}`.padEnd(22),
    i.reasons.join(","),
  );
}

const by = Object.fromEntries(r.items.map((i) => [i.equipmentId, i]));
console.assert(by.a.rr > by.c.rr, "хронический выше одиночного");
console.assert(by.b.reasons.includes("trend_up"), "рост обнаружен");
console.assert(!by.a.reasons.includes("trend_up"), "ровный ряд не помечен ростом");
console.assert(by.c.p1 < 0.2, "один отказ не даёт абсурдной вероятности");
console.assert(Math.abs(poissonTail(2, 1) - (1 - Math.exp(-1) * 2)) < 1e-9, "Пуассон: P(X>=2 | 1)");
console.assert(modifiedZ([5, 5, 6, 5, 4, 40]).at(-1)! > 3.5, "выброс по MAD");
const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.5]);
console.assert(Math.abs(q[0] - 0.04) < 1e-9 && Math.abs(q[1] - 0.0533333) < 1e-4 && Math.abs(q[2] - 0.0533333) < 1e-4 && q[3] === 0.5, "Бенджамини–Хохберг");
console.log("проверки выполнены (строки Assertion failed выше означают ошибку)");
