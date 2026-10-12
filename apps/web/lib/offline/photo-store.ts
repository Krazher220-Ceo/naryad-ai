// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

// Фото для офлайн-очереди. В localStorage фото не помещаются (там лимит около 5 МБ и только текст),
// поэтому храним их в IndexedDB браузера: ключ — случайный id, значение — сам файл.
// Очередь (queue.ts) хранит только id, а файл достаёт отсюда при отправке.

const DB_NAME = "naryad-offline";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Одна операция в отдельной транзакции: так проще и для очереди достаточно.
async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = action(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function savePhotos(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    const id = crypto.randomUUID();
    await run("readwrite", (s) => s.put(file, id));
    ids.push(id);
  }
  return ids;
}

export async function loadPhoto(id: string): Promise<File | null> {
  const value = await run<unknown>("readonly", (s) => s.get(id));
  return value instanceof File ? value : null;
}

export async function deletePhoto(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
