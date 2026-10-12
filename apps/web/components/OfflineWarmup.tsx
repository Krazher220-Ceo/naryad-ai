// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/roles";

// Прогрев офлайн-кэша: пока есть сеть, просим service worker сохранить экраны, которые понадобятся
// без связи — главную роли, уведомления, профиль, форму выдачи и наряды, ссылки на которые видны
// на текущем экране (вместе с формой закрытия для исполнителя). Не чаще раза в 5 минут на экран.
const EVERY_MS = 5 * 60 * 1000;

function screensFor(role: Role): string[] {
  const home = `/${role}`;
  const base = [home, "/notifications", "/profile"];
  if (role === "master") base.push("/master/orders/new", "/master/requests");
  return base;
}

export function OfflineWarmup({ role }: { role: Role }) {
  const pathname = usePathname();

  useEffect(() => {
    if (role === "operator" || !navigator.onLine || !navigator.serviceWorker?.controller) return;
    const key = `naryad-warm:${pathname}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < EVERY_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // sessionStorage недоступен — просто прогреваем каждый раз
    }

    // Ждём, пока экран дорисуется, и собираем ссылки на наряды прямо со страницы.
    const timer = setTimeout(() => {
      const orders = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href^="/${role}/orders/"]`))
        .map((a) => new URL(a.href).pathname)
        .filter((p) => /^\/[^/]+\/orders\/[0-9a-f-]{36}$/.test(p));
      const extra = role === "worker" ? orders.map((p) => `${p}/close`) : [];
      const urls = Array.from(new Set([...screensFor(role), ...orders, ...extra])).filter((u) => u !== pathname);
      navigator.serviceWorker.controller?.postMessage({ type: "warm", urls });
    }, 2000);
    return () => clearTimeout(timer);
  }, [role, pathname]);

  return null;
}
