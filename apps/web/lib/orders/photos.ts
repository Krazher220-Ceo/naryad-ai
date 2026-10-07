// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { createClient } from "@/lib/supabase/client";
import type { PhotoKind } from "./types";

// Загрузка фото наряда из браузера.
// 1. Сжимаем: длинная сторона до 1600 px, JPEG 80%. Фото с телефона 4–8 МБ становится ~300 КБ,
//    поэтому загрузка укладывается в 10 секунд даже на мобильной сети (п. 9.6 кейса).
// 2. Перерисовка через canvas заодно удаляет метаданные (геопозицию, модель телефона).
// 3. Кладём файл в хранилище по пути <order_id>/<kind>-<uuid>.jpg и пишем строку в photos.
// Права проверяет база: загрузить можно только в наряд, который ты видишь.

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;
export const MAX_PHOTOS_PER_KIND = 5;

export async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", JPEG_QUALITY),
  );
}

// Отпечаток файла: по нему в M3 ищется повторно загруженное старое фото.
async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadOrderPhoto(params: {
  orderId: string;
  kind: PhotoKind;
  file: File;
  authorId: string; // id сотрудника из employees
}): Promise<{ path: string }> {
  const supabase = createClient();
  const blob = await compress(params.file);
  const path = `${params.orderId}/${params.kind}-${crypto.randomUUID()}.jpg`;

  const upload = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
  if (upload.error) throw upload.error;

  const insert = await supabase.from("photos").insert({
    order_id: params.orderId,
    kind: params.kind,
    path,
    author_id: params.authorId,
    sha256: await sha256(blob),
    taken_at: new Date(params.file.lastModified).toISOString(),
  });
  if (insert.error) throw insert.error;

  return { path };
}
