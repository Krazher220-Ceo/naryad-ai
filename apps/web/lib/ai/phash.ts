// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.

// Перцептивный хеш dHash, 64 бита (16 hex-символов). Один алгоритм для браузера, Android и сервера.
// Картинка -> 9x8 пикселей -> яркость 0.299R + 0.587G + 0.114B ->
// в каждой строке сравниваем соседние пиксели: левый ярче правого = 1.
// Чистые функции без браузера и сервера: файл можно подключать откуда угодно.

export const PHASH_WIDTH = 9;
export const PHASH_HEIGHT = 8;
export const PHASH_PATTERN = /^[0-9a-f]{16}$/;

// rgba — данные картинки 9x8 (как ImageData.data): 4 байта на пиксель.
export function dHashFromRgba(rgba: ArrayLike<number>): string {
  const gray: number[] = [];
  for (let i = 0; i < PHASH_WIDTH * PHASH_HEIGHT; i++) {
    gray.push(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  let hex = "";
  for (let y = 0; y < PHASH_HEIGHT; y++) {
    let byte = 0;
    for (let x = 0; x < PHASH_WIDTH - 1; x++) {
      byte = (byte << 1) | (gray[y * PHASH_WIDTH + x] > gray[y * PHASH_WIDTH + x + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

// Сколько битов отличается у двух хешей. Меньше — похожее фото.
export function hammingHex(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}
