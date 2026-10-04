// QR-коды для проверки: страница жюри и тестовая наклейка оборудования. Результат — SVG в docs/qr.
// Запуск: node scripts/qr/make-test-qr.mjs [адрес-приложения]
// Библиотека qrcode берётся из apps/web (она уже есть в зависимостях приложения).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const QRCode = require("qrcode");

const APP = (process.argv[2] ?? "https://naryad-ai.vercel.app").replace(/\/$/, "");
const OUT = new URL("../../docs/qr/", import.meta.url);

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
function card({ url, title, subtitle, badge, lines }) {
  const W = 400;
  const qrSize = 300;
  const qrX = (W - qrSize) / 2;
  const qrY = 96;
  const { n, d } = qrModules(url);
  const quiet = 2; // белая рамка вокруг кода, в модулях
  const scale = qrSize / (n + quiet * 2);
  const badgeSize = qrSize * 0.22;
  const badgeXY = qrSize / 2 - badgeSize / 2;
  const textY = qrY + qrSize + 32;
  const H = textY + lines.length * 24 + 48;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, 'Segoe UI', Roboto, Arial, sans-serif">
  <title>${esc(title)}</title>
  <desc>QR-код: ${esc(url)}</desc>
  <defs><clipPath id="card"><rect width="${W}" height="${H}" rx="24"/></clipPath></defs>
  <rect width="${W}" height="${H}" rx="24" fill="#ffffff"/>
  <rect width="${W}" height="10" fill="#f59e0b" clip-path="url(#card)"/>
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="23" fill="none" stroke="#0f172a" stroke-width="3"/>
  <text x="${W / 2}" y="48" text-anchor="middle" font-size="26" font-weight="800" fill="#0f172a">${esc(title)}</text>
  <text x="${W / 2}" y="76" text-anchor="middle" font-size="16" fill="#475569">${esc(subtitle)}</text>
  <g transform="translate(${qrX} ${qrY})">
    <rect width="${qrSize}" height="${qrSize}" fill="#ffffff"/>
    <g transform="scale(${scale}) translate(${quiet} ${quiet})" shape-rendering="crispEdges">
      <path d="${d}" fill="#0f172a"/>
    </g>
    <rect x="${badgeXY}" y="${badgeXY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeSize * 0.22}" fill="#0f172a" stroke="#ffffff" stroke-width="5"/>
    <text x="${qrSize / 2}" y="${qrSize / 2 + badgeSize * 0.15}" text-anchor="middle" font-size="${badgeSize * 0.42}" font-weight="800" fill="#f59e0b">${esc(badge)}</text>
  </g>
${lines
  .map((l, i) => `  <text x="${W / 2}" y="${textY + i * 24}" text-anchor="middle" font-size="17" font-weight="${i === 0 ? 700 : 400}" fill="#0f172a">${esc(l)}</text>`)
  .join("\n")}
  <text x="${W / 2}" y="${H - 20}" text-anchor="middle" font-size="13" fill="#64748b">${esc(url)}</text>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });

const files = {
  "demo.svg": card({
    url: `${APP}/demo`,
    title: "НарядAI — проверка",
    subtitle: "Логины и сценарий для жюри",
    badge: "AI",
    lines: ["Мастер: master1 / 111111", "Исполнитель: worker1 / 222222", "Руководитель: lead1 / 333333"],
  }),
  // Тестовая наклейка: вход мастером → скан открывает выдачу наряда на этот насос.
  "equipment-test.svg": card({
    url: `${APP}/q/EQ-INV-2001`,
    title: "Насос шламовый НШ-2",
    subtitle: "Участок обогащения · INV-2001",
    badge: "Н",
    lines: ["Отсканируйте, войдя как мастер:", "откроется выдача наряда", "с выбранным оборудованием"],
  }),
};

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), svg);
  console.log(`docs/qr/${name}`);
}
console.log("Данные демонстрационные.");
