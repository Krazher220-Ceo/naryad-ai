// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Табличка оборудования одним SVG-текстом. Из него же получаются предпросмотр,
// печать, скачивание SVG и PNG, поэтому все виды выглядят одинаково.
// Размер 600 x 840 условных единиц (пропорции 5:7).

export type PlateData = {
  id: string;
  name: string;
  inventoryNo: string;
  sectionName: string;
  shortUrl: string; // адрес без https:// для запасной подписи
  qrSize: number; // модулей по стороне
  qrPath: string; // чёрные модули
};

export type PlateLabels = { app: string; company: string; cta: string; inventory: string };

export const PLATE_W = 600;
export const PLATE_H = 840;

// Цвета из токенов app/globals.css (ink, brand, accent). В файле SVG нужны готовые значения.
const NAVY = "#07316e";
const INK = "#001636";
const ACCENT = "#ffc107";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Делит название на строки по словам, не больше maxLines; лишнее заменяется на «…»
export function wrapName(name: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of name.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + " " + word).length > maxChars) {
      lines.push(cur);
      cur = word;
    } else {
      cur = cur ? cur + " " + word : word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, maxChars - 1).trimEnd() + "…";
    return kept;
  }
  return lines.map((line) => (line.length > maxChars ? line.slice(0, maxChars - 1) + "…" : line));
}

// logoInner — содержимое km-logo.svg без внешнего <svg> (белый логотип 124 x 80).
// heading — шрифт заголовков: на странице Oswald с сайта, в скачанном файле запасные шрифты.
export function plateSvg(p: PlateData, l: PlateLabels, logoInner: string, heading: string): string {
  const body = "Inter, Arial, Helvetica, sans-serif";
  const lines = wrapName(p.name, 24, 2);

  // Код с белым полем в 4 модуля со всех сторон: это обязательная «тихая зона».
  const box = 400;
  const boxX = (PLATE_W - box) / 2;
  const boxY = 145;
  const cell = box / (p.qrSize + 8);

  const nameY = 610;
  const nameEnd = nameY + (lines.length - 1) * 46;
  const nameText = lines.map((line, i) => `<tspan x="300" y="${nameY + i * 46}">${esc(line)}</tspan>`).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLATE_W} ${PLATE_H}" width="${PLATE_W}" height="${PLATE_H}">` +
    `<rect width="${PLATE_W}" height="${PLATE_H}" rx="28" fill="#fff"/>` +
    `<path d="M0 28a28 28 0 0 1 28-28h544a28 28 0 0 1 28 28V118H0z" fill="${NAVY}"/>` +
    `<rect y="118" width="${PLATE_W}" height="10" fill="${ACCENT}"/>` +
    `<g transform="translate(28 20)">${logoInner}</g>` +
    `<text x="170" y="62" font-family="${heading}" font-size="40" font-weight="600" fill="#fff">${esc(l.app)}</text>` +
    `<text x="170" y="92" font-family="${body}" font-size="17" font-weight="700" letter-spacing="1.5" fill="${ACCENT}">${esc(l.company.toUpperCase())}</text>` +
    // QR: белая подложка и чисто чёрные модули
    `<rect x="${boxX}" y="${boxY}" width="${box}" height="${box}" fill="#fff"/>` +
    `<g transform="translate(${boxX + 4 * cell} ${boxY + 4 * cell}) scale(${cell})"><path d="${p.qrPath}" fill="#000" shape-rendering="crispEdges"/></g>` +
    `<text text-anchor="middle" font-family="${heading}" font-size="42" font-weight="700" fill="${INK}">${nameText}</text>` +
    `<text x="300" y="${nameEnd + 44}" text-anchor="middle" font-family="${body}" font-size="28" font-weight="700" fill="${INK}">${esc(l.inventory)} ${esc(p.inventoryNo)}</text>` +
    `<text x="300" y="${nameEnd + 78}" text-anchor="middle" font-family="${body}" font-size="24" fill="${INK}">${esc(p.sectionName)}</text>` +
    `<rect x="30" y="736" width="540" height="58" rx="14" fill="${INK}"/>` +
    `<text x="300" y="773" text-anchor="middle" font-family="${body}" font-size="24" font-weight="700" fill="#fff">${esc(l.cta)}</text>` +
    `<text x="300" y="823" text-anchor="middle" font-family="${body}" font-size="18" fill="${INK}">${esc(p.shortUrl)}</text>` +
    `</svg>`
  );
}
