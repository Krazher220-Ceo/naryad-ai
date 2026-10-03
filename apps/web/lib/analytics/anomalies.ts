import "server-only";
import { describeAnomalies } from "@/lib/ai/summaries";
import { downtimeMinutes, isNight, loadHistory, type History, type HistoryOrder } from "./history";

// Поиск аномалий и зависимостей (п. 6.5 кейса). Цифры и пороги — код.
// Модель получает готовые факты карточек и пишет вывод с рекомендацией простым языком.
// Каждый детектор — отдельная маленькая функция: её легко объяснить и проверить.

export type AnomalyKind =
  | "problem_equipment" // оборудование ломается чаще однотипного
  | "repeat_fault" // один шифр на одной машине повторяется — ремонт не устраняет причину
  | "after_planned" // поломки вскоре после планового ремонта — качество ППР
  | "shift" // связь поломок со сменой
  | "worker_returns" // исполнитель с возвратами на доработку
  | "material_overuse" // аномальный расход материалов
  | "failure_trend"; // рост внеплановых нарядов — прогноз отказа

export type Anomaly = {
  id: string;
  kind: AnomalyKind;
  severity: "high" | "medium";
  subject: string; // оборудование, участок, исполнитель, материал
  facts: Record<string, number | string>;
  text: string; // вывод для людей
  recommendation: string;
  source: "llm" | "rules";
};

type Draft = Omit<Anomaly, "text" | "recommendation" | "source">;

const DAY = 24 * 60 * 60 * 1000;
const round1 = (x: number) => Math.round(x * 10) / 10;
const share = (part: number, all: number) => (all > 0 ? Math.round((part / all) * 100) : 0);

function countBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

const unplannedOf = (orders: HistoryOrder[]) => orders.filter((o) => o.type === "unplanned" && o.status !== "cancelled");

// 1. Оборудование с внеплановыми нарядами минимум вдвое чаще, чем в среднем у однотипного.
function problemEquipment(h: History): Draft[] {
  const unplanned = unplannedOf(h.orders);
  const byEquipment = countBy(unplanned, (o) => o.equipment?.id ?? null);
  const drafts: Draft[] = [];
  for (const [, orders] of byEquipment) {
    const eq = orders[0].equipment!;
    const sameType = [...byEquipment.values()].filter((list) => list[0].equipment!.type === eq.type && list[0].equipment!.id !== eq.id);
    const peers = sameType.length > 0 ? sameType : [...byEquipment.values()].filter((list) => list[0].equipment!.id !== eq.id);
    const peerMean = peers.reduce((s, list) => s + list.length, 0) / Math.max(1, peers.length);
    const ratio = peerMean > 0 ? orders.length / peerMean : 0;
    if (orders.length >= 5 && ratio >= 2) {
      const downtime = Math.round(orders.reduce((s, o) => s + downtimeMinutes(o), 0) / 60);
      drafts.push({
        id: `problem_equipment:${eq.id}`,
        kind: "problem_equipment",
        severity: ratio >= 3 ? "high" : "medium",
        subject: eq.name,
        facts: { unplanned: orders.length, peerMean: round1(peerMean), ratio: round1(ratio), downtimeHours: downtime, peers: sameType.length > 0 ? eq.type : "*" },
      });
    }
  }
  return drafts;
}

// 2. Один шифр на одной машине: не меньше 5 раз и не меньше половины её поломок.
function repeatFault(h: History): Draft[] {
  const unplanned = unplannedOf(h.orders);
  const byEquipment = countBy(unplanned, (o) => o.equipment?.id ?? null);
  const drafts: Draft[] = [];
  for (const [, orders] of byEquipment) {
    const byCode = countBy(orders, (o) => o.fault_code);
    for (const [code, list] of byCode) {
      if (list.length >= 5 && list.length / orders.length >= 0.5) {
        const eq = orders[0].equipment!;
        drafts.push({
          id: `repeat_fault:${eq.id}:${code}`,
          kind: "repeat_fault",
          severity: list.length / orders.length >= 0.7 ? "high" : "medium",
          subject: eq.name,
          facts: { code, repeats: list.length, ofUnplanned: orders.length, sharePct: share(list.length, orders.length) },
        });
      }
    }
  }
  return drafts;
}

// 3. Поломки в течение 5 дней после планового ремонта: доля вдвое выше, чем по заводу.
function afterPlanned(h: History): Draft[] {
  const done = h.orders.filter((o) => o.done_at && o.status !== "cancelled");
  const planned = done.filter((o) => o.type === "planned");
  const unplanned = unplannedOf(h.orders);
  const brokeSoon = (p: HistoryOrder) => {
    const end = new Date(p.done_at!).getTime();
    return unplanned.some((u) => {
      const t = new Date(u.created_at).getTime();
      return u.equipment?.id === p.equipment?.id && t > end && t - end <= 5 * DAY;
    });
  };
  const plantRate = planned.filter(brokeSoon).length / Math.max(1, planned.length);
  const drafts: Draft[] = [];
  for (const [, list] of countBy(planned, (o) => o.equipment?.id ?? null)) {
    const bad = list.filter(brokeSoon).length;
    const rate = bad / list.length;
    if (list.length >= 4 && rate >= 0.5 && rate >= plantRate * 2) {
      drafts.push({
        id: `after_planned:${list[0].equipment!.id}`,
        kind: "after_planned",
        severity: "high",
        subject: list[0].equipment!.name,
        facts: { planned: list.length, brokeWithin5Days: bad, ratePct: share(bad, list.length), plantRatePct: Math.round(plantRate * 100) },
      });
    }
  }
  return drafts;
}

// 4. Участок, где ночью поломок заметно больше, чем днём, по сравнению с остальными участками.
function shiftDependency(h: History): Draft[] {
  const unplanned = unplannedOf(h.orders);
  const bySection = countBy(unplanned, (o) => o.section?.id ?? null);
  const drafts: Draft[] = [];
  for (const [id, list] of bySection) {
    const night = list.filter((o) => isNight(o.created_at)).length;
    const day = list.length - night;
    const others = unplanned.filter((o) => o.section?.id !== id);
    const othersNight = others.filter((o) => isNight(o.created_at)).length;
    const othersRatio = othersNight / Math.max(1, others.length - othersNight);
    const ratio = night / Math.max(1, day);
    if (list.length >= 10 && ratio >= 1.5 && ratio >= othersRatio * 2) {
      drafts.push({
        id: `shift:${id}`,
        kind: "shift",
        severity: "medium",
        subject: list[0].section!.name,
        facts: { night, day, ratio: round1(ratio), othersRatio: round1(othersRatio) },
      });
    }
  }
  return drafts;
}

// 5. Исполнитель, у которого возвратов на доработку втрое больше, чем у остальных.
function workerReturns(h: History): Draft[] {
  const closed = h.orders.filter((o) => o.assignee && o.done_at);
  const drafts: Draft[] = [];
  for (const [id, list] of countBy(closed, (o) => o.assignee?.id ?? null)) {
    const returns = list.filter((o) => h.reworkedOrderIds.has(o.id)).length;
    const others = closed.filter((o) => o.assignee?.id !== id);
    const othersRate = others.filter((o) => h.reworkedOrderIds.has(o.id)).length / Math.max(1, others.length);
    const rate = returns / list.length;
    if (list.length >= 10 && returns >= 3 && rate >= Math.max(0.15, othersRate * 3)) {
      drafts.push({
        id: `worker_returns:${id}`,
        kind: "worker_returns",
        severity: "high",
        subject: list[0].assignee!.full_name,
        facts: { orders: list.length, returns, ratePct: share(returns, list.length), othersRatePct: Math.round(othersRate * 100) },
      });
    }
  }
  return drafts;
}

// 6. Перерасход: списано больше двух обычных норм. Ищем, где такие случаи сосредоточены.
function materialOveruse(h: History): Draft[] {
  const orderById = new Map(h.orders.map((o) => [o.id, o]));
  const over = h.usages.filter((u) => u.material && u.qty > u.material.typical_qty * 2 && orderById.has(u.order_id));
  if (over.length < 5) return [];
  const groups = countBy(over, (u) => {
    const o = orderById.get(u.order_id)!;
    return `${o.section?.name ?? "—"}|${isNight(o.created_at) ? "night" : "day"}|${u.material!.name}`;
  });
  const drafts: Draft[] = [];
  for (const [key, list] of groups) {
    if (list.length >= 5 && list.length / over.length >= 0.4) {
      const [section, shift, material] = key.split("|");
      const avgRatio = list.reduce((s, u) => s + u.qty / u.material!.typical_qty, 0) / list.length;
      drafts.push({
        id: `material_overuse:${key}`,
        kind: "material_overuse",
        severity: "medium",
        subject: material,
        facts: { section, shift, cases: list.length, ofAllOveruse: over.length, avgTimesNorm: round1(avgRatio) },
      });
    }
  }
  return drafts;
}

// 7. Прогноз отказа: внеплановых нарядов за последние 14 дней вдвое больше, чем за предыдущие 14.
function failureTrend(h: History, to: Date): Draft[] {
  const unplanned = unplannedOf(h.orders);
  const end = to.getTime();
  const drafts: Draft[] = [];
  for (const [, list] of countBy(unplanned, (o) => o.equipment?.id ?? null)) {
    const recent = list.filter((o) => end - new Date(o.created_at).getTime() <= 14 * DAY).length;
    const before = list.filter((o) => {
      const age = end - new Date(o.created_at).getTime();
      return age > 14 * DAY && age <= 28 * DAY;
    }).length;
    // Не меньше 4 случаев: на 2–3 нарядах «рост» — это шум.
    if (recent >= 4 && recent >= before * 2) {
      drafts.push({
        id: `failure_trend:${list[0].equipment!.id}`,
        kind: "failure_trend",
        severity: recent >= 8 && recent >= before * 3 ? "high" : "medium",
        subject: list[0].equipment!.name,
        facts: { last14: recent, previous14: before },
      });
    }
  }
  return drafts;
}

export async function findAnomalies(days = 90): Promise<{ anomalies: Anomaly[]; period: { from: string; to: string } }> {
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY);
  const history = await loadHistory(from, to);

  const drafts: Draft[] = [
    ...problemEquipment(history),
    ...repeatFault(history),
    ...afterPlanned(history),
    ...shiftDependency(history),
    ...workerReturns(history),
    ...materialOveruse(history),
    ...failureTrend(history, to),
  ];

  // Порядок карточек: сначала по одной самой сильной карточке каждого вида, потом остальные.
  // Так в превью на дашборде видны разные закономерности, а не три карточки про один конвейер.
  const rank = (d: Draft) => (d.severity === "high" ? 0 : 1);
  const sorted = [...drafts].sort((a, b) => rank(a) - rank(b));
  const firstOfKind = sorted.filter((d, i) => sorted.findIndex((x) => x.kind === d.kind) === i);
  const rest = sorted.filter((d) => !firstOfKind.includes(d));
  const ordered = [...firstOfKind.sort((a, b) => rank(a) - rank(b)), ...rest];

  const texts = await describeAnomalies(ordered);
  const anomalies = ordered.map((d) => ({ ...d, ...texts[d.id] }));
  return { anomalies, period: { from: from.toISOString(), to: to.toISOString() } };
}
