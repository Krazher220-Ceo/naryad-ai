// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import type { Db } from "./db";
import type { HistoryOrder } from "./history";
import { ewma, poissonTail } from "./stats";

// Прогноз отказов по оборудованию (п. 6.5 кейса, «прогноз вероятного отказа»).
// Считает код, по формулам из docs/analytics-methods.md. Модель сюда не подключается.
//
// Идея в трёх шагах:
//  1. MTBF (среднее время между отказами) оборудования, подтянутое к среднему по заводу, если отказов мало.
//  2. Проверка, не участились ли отказы за последние 30 дней (критерий Пуассона).
//  3. Вероятность хотя бы одного отказа за 7 дней по экспоненциальной модели.

const DAY = 24 * 60 * 60 * 1000;
export const FORECAST_HORIZON_DAYS = 7;
const RECENT_DAYS = 30; // «последние» дни для проверки роста
const SHRINK_K = 2; // вес среднего по заводу, в «условных отказах»
const TREND_P = 0.05;
const TREND_MIN_EVENTS = 2;
const TREND_CAP = 2; // рост учитывается не больше чем вдвое: долгая интенсивность уже включает часть роста
const WEEKS = 13; // 13 недель = 91 день

export type ForecastReason = "trend_up" | "high_rate" | "recent_failure" | "little_data";

export type EquipmentForecast = {
  equipmentId: string;
  name: string;
  section: string | null;
  failures90d: number;
  mtbfDays: number; // после подтяжки к среднему по заводу
  daysSinceLast: number | null;
  p7: number; // вероятность хотя бы одного отказа за 7 дней, 0..1
  trendFactor: number; // 1 = без роста
  failures30: number; // отказов за последние 30 дней
  expected30: number; // сколько ждали по предыдущим 60 дням
  pValue: number; // вероятность увидеть не меньше отказов случайно
  rateRatio: number; // во сколько раз интенсивность выше, чем в среднем по заводу
  weekly: number[]; // отказов по неделям, старые слева
  weeklyEwma: number[]; // то же, сглаженное (alpha 0.3)
  reasons: ForecastReason[];
};

export type ForecastReport = {
  period: { from: string; to: string };
  fleetMtbfDays: number;
  items: EquipmentForecast[]; // по убыванию p7
};

const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;

// MTBF с подтяжкой. Окно наблюдения T дней делится отказами на интервалы (в сумме они дают T).
//   mtbf = (сумма интервалов + k * mtbf_завода) / (n + k)
// При n = 0 получаем почти средний по заводу, при большом n — собственное T / n.
export function shrunkMtbf(windowDays: number, failures: number, fleetMtbf: number, k = SHRINK_K): number {
  return (windowDays + k * fleetMtbf) / (failures + k);
}

// Вероятность хотя бы одного отказа за horizon дней при постоянной интенсивности 1 / mtbf:
// p = 1 - e^(-horizon / mtbf). Множитель factor увеличивает интенсивность.
export function failureProbability(mtbfDays: number, horizonDays = FORECAST_HORIZON_DAYS, factor = 1): number {
  return 1 - Math.exp((-horizonDays * factor) / mtbfDays);
}

// Проверка роста: k отказов за последние 30 дней против ожидаемых по предыдущим дням.
// +0.5 к прошлым отказам: машина без отказов раньше не должна давать нулевое «ожидание».
export function trendTest(times: number[], end: number, windowDays: number) {
  const failures30 = times.filter((t) => end - t <= RECENT_DAYS * DAY).length;
  const before = times.length - failures30;
  const beforeDays = Math.max(1, windowDays - RECENT_DAYS);
  const expected30 = ((before + 0.5) / beforeDays) * RECENT_DAYS;
  const pValue = poissonTail(failures30, expected30);
  const significant = failures30 >= TREND_MIN_EVENTS && pValue < TREND_P;
  return { failures30, expected30, pValue, significant };
}

export function computeForecast(orders: HistoryOrder[], from: Date, to: Date): ForecastReport {
  const end = to.getTime();
  const windowDays = Math.max(1, (end - from.getTime()) / DAY);

  // Список оборудования берём из истории: все, по чему были наряды любого вида.
  const equipment = new Map<string, { name: string; section: string | null; failures: number[] }>();
  for (const o of orders) {
    if (!o.equipment || o.status === "cancelled") continue;
    const entry = equipment.get(o.equipment.id) ?? { name: o.equipment.name, section: o.section?.name ?? null, failures: [] };
    if (o.type === "unplanned") entry.failures.push(new Date(o.created_at).getTime());
    equipment.set(o.equipment.id, entry);
  }

  const totalFailures = [...equipment.values()].reduce((s, e) => s + e.failures.length, 0);
  // Средний MTBF по заводу: суммарное время наблюдения всех машин / все отказы.
  const fleetMtbf = totalFailures > 0 ? (windowDays * equipment.size) / totalFailures : windowDays;

  const items: EquipmentForecast[] = [];
  for (const [equipmentId, e] of equipment) {
    const times = e.failures.sort((a, b) => a - b);
    const n = times.length;
    const mtbf = shrunkMtbf(windowDays, n, fleetMtbf);

    const trend = trendTest(times, end, windowDays);
    // Рост интенсивности учитываем в прогнозе, только если он статистически значим.
    const trendFactor = trend.significant ? Math.min(TREND_CAP, Math.max(1, (trend.failures30 + 0.5) / (trend.expected30 + 0.5))) : 1;

    // Отказы по неделям (последняя неделя справа) и их сглаживание — для линии на экране.
    const weekly = new Array<number>(WEEKS).fill(0);
    for (const t of times) {
      const weeksAgo = Math.floor((end - t) / (7 * DAY));
      if (weeksAgo >= 0 && weeksAgo < WEEKS) weekly[WEEKS - 1 - weeksAgo] += 1;
    }

    const daysSinceLast = n > 0 ? Math.max(0, (end - times[n - 1]) / DAY) : null;
    const rateRatio = fleetMtbf / mtbf;
    const reasons: ForecastReason[] = [];
    if (trend.significant) reasons.push("trend_up");
    if (rateRatio >= 2) reasons.push("high_rate");
    if (daysSinceLast !== null && daysSinceLast <= 2) reasons.push("recent_failure");
    if (n < 3) reasons.push("little_data");

    items.push({
      equipmentId,
      name: e.name,
      section: e.section,
      failures90d: n,
      mtbfDays: round(mtbf, 1),
      daysSinceLast: daysSinceLast === null ? null : round(daysSinceLast, 1),
      p7: round(failureProbability(mtbf, FORECAST_HORIZON_DAYS, trendFactor), 3),
      trendFactor: round(trendFactor, 2),
      failures30: trend.failures30,
      expected30: round(trend.expected30, 1),
      pValue: round(trend.pValue, 4),
      rateRatio: round(rateRatio, 1),
      weekly,
      weeklyEwma: ewma(weekly, 0.3).map((x) => round(x, 2)),
      reasons,
    });
  }

  items.sort((a, b) => b.p7 - a.p7 || a.mtbfDays - b.mtbfDays);
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    fleetMtbfDays: round(fleetMtbf, 1),
    items,
  };
}

// Для кэша отчётов: загрузка истории и расчёт. Импорт внутри функции, чтобы расчётную часть можно было проверять без базы.
export async function getForecast(days = 90, db?: Db): Promise<ForecastReport> {
  const { loadHistory } = await import("./history");
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY);
  const history = await loadHistory(from, to, db);
  return computeForecast(history.orders, from, to);
}
