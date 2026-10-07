// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.

// Простая статистика без библиотек. Каждая функция маленькая и считает одну формулу.
// Здесь только математика: ни базы, ни модели. Поэтому файл можно запустить и проверить отдельно.

export const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Хвост закона Пуассона: P(X >= k) при ожидаемом числе событий lambda.
// P(X >= k) = 1 - сумма по i от 0 до k-1 из e^(-lambda) * lambda^i / i!
// Малое значение = «столько событий случайно почти не бывает».
export function poissonTail(k: number, lambda: number): number {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  let term = Math.exp(-lambda); // слагаемое для i = 0
  let sum = 0;
  for (let i = 0; i < k; i++) {
    sum += term;
    term = (term * lambda) / (i + 1); // следующее слагаемое: умножаем на lambda / (i + 1)
  }
  return Math.min(1, Math.max(0, 1 - sum));
}

// Модифицированный z-показатель (Айглвич и Хоаглин): устойчив к самим выбросам, в отличие от среднего и стандартного отклонения.
//   z = 0.6745 * (x - медиана) / MAD, где MAD = медиана |x - медиана|.
// Выброс: |z| > 3.5. Если MAD равен нулю (больше половины значений одинаковы), берём запасной масштаб
// из среднего отклонения: z = (x - медиана) / (1.253314 * среднее |x - медиана|).
export function modifiedZ(values: number[]): number[] {
  if (values.length < 3) return values.map(() => 0);
  const med = median(values);
  const deviations = values.map((x) => Math.abs(x - med));
  const mad = median(deviations);
  if (mad > 0) return values.map((x) => (0.6745 * (x - med)) / mad);
  const meanDev = mean(deviations);
  if (meanDev > 0) return values.map((x) => (x - med) / (1.253314 * meanDev));
  return values.map(() => 0);
}

export const OUTLIER_Z = 3.5;

// Экспоненциальное сглаживание ряда: s[i] = alpha * x[i] + (1 - alpha) * s[i-1].
// Чем меньше alpha, тем плавнее линия и тем меньше она реагирует на одну неделю.
export function ewma(series: number[], alpha = 0.3): number[] {
  const out: number[] = [];
  for (const x of series) out.push(out.length === 0 ? x : alpha * x + (1 - alpha) * out[out.length - 1]);
  return out;
}

// Поправка Бенджамини–Хохберга на множественные проверки (контроль доли ложных открытий, FDR).
// Проверяем много машин сразу, и при p < 0,05 одна-две «находки» появятся случайно. Поправка исправляет это:
//   1. сортируем p-значения по возрастанию: p(1) <= ... <= p(m);
//   2. q(i) = p(i) * m / i;
//   3. идём с конца и берём минимум: q(i) = min(q(i), q(i+1)), чтобы q не убывал с ростом p.
// Находка значима, если q < 0,1 (не больше 10% ложных среди найденных).
export const FDR_Q = 0.1;

export function benjaminiHochberg(ps: number[]): number[] {
  const m = ps.length;
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const q = new Array<number>(m).fill(1);
  let running = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = order[rank - 1];
    running = Math.min(running, (p * m) / rank);
    q[i] = Math.min(1, running);
  }
  return q;
}
