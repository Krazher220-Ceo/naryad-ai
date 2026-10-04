// QR-коды для проверки: страница жюри и тестовая наклейка оборудования. Результат — SVG в docs/qr.
// В центре кода и в полосе снизу — логотип АО «Костанайские минералы» (docs/brand), белый на тёмном.
// Заодно собирается белый блок «логотип — черта — НарядAI» для слайдов и печати: docs/brand.
// Запуск: node scripts/qr/make-test-qr.mjs [адрес-приложения]
// Библиотека qrcode берётся из apps/web (она уже есть в зависимостях приложения).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const QRCode = require("qrcode");

const APP = (process.argv[2] ?? "https://naryad-ai.vercel.app").replace(/\/$/, "");
const OUT = new URL("../../docs/qr/", import.meta.url);

const BRAND = new URL("../../docs/brand/", import.meta.url);
// Цвета сайта km.kz: тёмно-синий и жёлтый акцент.
const NAVY = "#001636";
const AMBER = "#ffc107";
const BLUE = "#07316e";

// Логотип: берём содержимое svg без обёртки. Знак и надпись лежат в рамке x 10…116, y 9…71.
const LOGO = readFileSync(new URL("kostanay-minerals-logo.svg", BRAND), "utf8")
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .trim();
const LOGO_BOX = { x: 10, y: 9, w: 106, h: 62 };

// Логотип шириной w, левый верхний угол в (x, y). Цвет — белый, как в исходном файле.
function logo(x, y, w) {
  const k = w / LOGO_BOX.w;
  return `<g transform="translate(${x} ${y}) scale(${k}) translate(${-LOGO_BOX.x} ${-LOGO_BOX.y})">${LOGO}</g>`;
}
const logoHeight = (w) => (w * LOGO_BOX.h) / LOGO_BOX.w;

// Подпись под логотипом: короткая черта и «НарядAI». Всё по центру cx.
function lockup(cx, y, w, { dash = AMBER, text = "#ffffff", accent = AMBER, size = 26 } = {}) {
  const lh = logoHeight(w);
  const dashY = y + lh + 14;
  const textY = dashY + 14 + size;
  return {
    svg:
      logo(cx - w / 2, y, w) +
      `<rect x="${cx - 24}" y="${dashY}" width="48" height="4" rx="2" fill="${dash}"/>` +
      `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${text}" font-family="Oswald, Inter, sans-serif">Наряд<tspan fill="${accent}">AI</tspan></text>`,
    height: textY - y + 8,
  };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Модули QR-кода в виде одного пути. Уровень H: центр можно закрыть значком, код всё равно читается.
function qrModules(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
  }
  return { n, d };
}

// Карточка: заголовок, QR со значком по центру, строки текста и адрес под кодом.
function card({ url, title, subtitle, lines }) {
  const W = 400;
  const qrSize = 300;
  const qrX = (W - qrSize) / 2;
  const qrY = 96;
  const { n, d } = qrModules(url);
  const quiet = 2; // белая рамка вокруг кода, в модулях
  const scale = qrSize / (n + quiet * 2);
  // Плашка с логотипом: около 6% площади кода, уровень H это выдерживает.
  const badgeW = qrSize * 0.28;
  const badgeH = qrSize * 0.21;
  const badgeX = qrSize / 2 - badgeW / 2;
  const badgeY = qrSize / 2 - badgeH / 2;
  const logoW = badgeW * 0.8;
  const textY = qrY + qrSize + 32;
  const urlY = textY + lines.length * 24 + 8;
  const band = lockup(W / 2, urlY + 40, 120);
  const bandY = urlY + 20;
  const H = bandY + band.height + 40;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, 'Segoe UI', Roboto, Arial, sans-serif">
  <title>${esc(title)}</title>
  <desc>QR-код: ${esc(url)}</desc>
  <defs><clipPath id="card"><rect width="${W}" height="${H}" rx="24"/></clipPath></defs>
  <rect width="${W}" height="${H}" rx="24" fill="#ffffff"/>
  <rect width="${W}" height="10" fill="${AMBER}" clip-path="url(#card)"/>
  <text x="${W / 2}" y="50" text-anchor="middle" font-size="30" font-weight="700" fill="${NAVY}" font-family="Oswald, Inter, sans-serif">${esc(title)}</text>
  <text x="${W / 2}" y="76" text-anchor="middle" font-size="16" fill="#475569">${esc(subtitle)}</text>
  <g transform="translate(${qrX} ${qrY})">
    <rect width="${qrSize}" height="${qrSize}" fill="#ffffff"/>
    <g transform="scale(${scale}) translate(${quiet} ${quiet})" shape-rendering="crispEdges">
      <path d="${d}" fill="${BLUE}"/>
    </g>
    <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="10" fill="${NAVY}" stroke="#ffffff" stroke-width="5"/>
    ${logo(qrSize / 2 - logoW / 2, qrSize / 2 - logoHeight(logoW) / 2, logoW)}
  </g>
${lines
  .map((l, i) => `  <text x="${W / 2}" y="${textY + i * 24}" text-anchor="middle" font-size="17" font-weight="${i === 0 ? 700 : 400}" fill="${NAVY}">${esc(l)}</text>`)
  .join("\n")}
  <text x="${W / 2}" y="${urlY}" text-anchor="middle" font-size="13" fill="#64748b">${esc(url)}</text>
  <rect y="${bandY}" width="${W}" height="${H - bandY}" fill="${NAVY}" clip-path="url(#card)"/>
  ${band.svg}
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="23" fill="none" stroke="${NAVY}" stroke-width="3"/>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });

const files = {
  "demo.svg": card({
    url: `${APP}/demo`,
    title: "НарядAI — проверка",
    subtitle: "Логины и сценарий для жюри",
    lines: ["Мастер: master1 / master2026", "Исполнитель: worker1 / worker2026", "Руководитель: lead1 / lead2026"],
  }),
  // Тестовая наклейка: вход мастером → скан открывает выдачу наряда на этот насос.
  "equipment-test.svg": card({
    url: `${APP}/q/EQ-INV-2001`,
    title: "Насос шламовый НШ-2",
    subtitle: "Участок обогащения · INV-2001",
    lines: ["Отсканируйте, войдя как мастер:", "откроется выдача наряда", "с выбранным оборудованием"],
  }),
};

// Белый вариант: логотип, черта и «НарядAI» — всё белое, фон прозрачный.
const white = lockup(120, 16, 200, { dash: "#ffffff", text: "#ffffff", accent: "#ffffff", size: 34 });
writeFileSync(
  new URL("naryad-lockup-white.svg", BRAND),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="${white.height + 24}" viewBox="0 0 240 ${white.height + 24}" font-family="Inter, 'Segoe UI', Roboto, Arial, sans-serif">
  <title>НарядAI — АО «Костанайские минералы»</title>
  ${white.svg}
</svg>
`,
);
console.log("docs/brand/naryad-lockup-white.svg");

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), svg);
  console.log(`docs/qr/${name}`);
}
console.log("Данные демонстрационные.");
