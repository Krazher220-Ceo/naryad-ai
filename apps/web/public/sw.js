// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Service worker НарядAI: работа без сети (PLAN.md, раздел 4, «Офлайн»).
//
// 1. Файлы приложения (/_next/static, шрифты, иконки) — сначала из кэша: они не меняются,
//    у каждого в имени свой хеш.
// 2. Экраны — сначала из сети. Удачный ответ сохраняется; без сети показывается последняя
//    сохранённая версия этого экрана, а если её нет — страница «Нет сети».
// 3. Запросы к /api, Supabase и действия (POST) не кэшируются: действия без сети копит
//    офлайн-очередь (lib/offline/queue.ts), а не service worker.
// Кэш экранов очищается при выходе из аккаунта и кнопкой в профиле.

const VERSION = "v2";
const STATIC_CACHE = `naryad-static-${VERSION}`;
const PAGES_CACHE = `naryad-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k)))),
    ]),
  );
});

// Выход из аккаунта: страница присылает сообщение, и сохранённые экраны удаляются.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/");
}

// Старые экраны убираем, чтобы кэш не рос бесконечно.
async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase и прочие сервисы
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/downloads/")) return; // APK не кладём в кэш

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES_CACHE);
        try {
          const response = await fetch(request);
          // Сохраняем только обычные страницы, а не переадресации на вход.
          if (response.ok && !response.redirected) {
            await cache.put(url.pathname + url.search, response.clone());
            trim(cache);
          }
          return response;
        } catch {
          return (await cache.match(url.pathname + url.search)) || (await cache.match(url.pathname)) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});
