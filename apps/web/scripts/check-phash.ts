// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { dHashFromRgba, hammingHex } from "../lib/ai/phash";

// Самопроверка dHash: npx tsx scripts/check-phash.ts
// Синтетическая картинка 9x8 — те же числа использует Kotlin (PerceptualHash.fromPixels).
const rgba: number[] = [];
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 9; x++) {
    rgba.push((x * 37 + y * 91) % 256, (x * 53 + y * 17) % 256, (x * 11 + y * 71) % 256, 255);
  }
}
const hash = dHashFromRgba(rgba);
console.log("dhash", hash);

const flipped = hash.slice(0, 15) + (parseInt(hash[15], 16) ^ 0b0011).toString(16);
const checks: [string, boolean][] = [
  ["длина 16", hash.length === 16],
  ["расстояние до себя 0", hammingHex(hash, hash) === 0],
  ["два изменённых бита = 2", hammingHex(hash, flipped) === 2],
  ["все биты разные = 64", hammingHex("0000000000000000", "ffffffffffffffff") === 64],
];
for (const [name, ok] of checks) console.log(ok ? "ok  " : "FAIL", name);
if (checks.some(([, ok]) => !ok)) process.exit(1);
