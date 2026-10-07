// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { flushQueue, pendingActions, QUEUE_EVENT, type QueuedAction } from "./queue";

// Состояние связи для плашки «В сети / Отправка / Нет сети / Ошибка» (PLAN.md, раздел 8.1).
// Отправляет офлайн-очередь при появлении сети. Кладётся один раз в каркас приложения.

export type ConnectionStatus = "online" | "sending" | "offline" | "error";

type ConnectionState = {
  status: ConnectionStatus;
  pending: QueuedAction[];
  failed: string[];
  // Время последней удачной отправки или проверки, для подписи «всё отправлено · 10:42».
  syncedAt: Date | null;
  retry: () => void;
  clearFailed: () => void;
};

const ConnectionContext = createContext<ConnectionState | null>(null);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<QueuedAction[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const update = useCallback(() => {
    setPending(pendingActions());
    setOnline(navigator.onLine);
  }, []);

  const sync = useCallback(async () => {
    update();
    if (!navigator.onLine) return;
    if (pendingActions().length === 0) {
      setSyncedAt(new Date());
      return;
    }
    setSending(true);
    try {
      const result = await flushQueue();
      if (result.failed.length) setFailed((prev) => [...prev, ...result.failed]);
      if (result.sent || result.failed.length) router.refresh();
      if (pendingActions().length === 0) setSyncedAt(new Date());
    } finally {
      setSending(false);
      update();
    }
  }, [router, update]);

  useEffect(() => {
    // Первую проверку откладываем на следующий тик: состояние меняется не прямо в эффекте.
    const first = setTimeout(sync, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", update);
    window.addEventListener(QUEUE_EVENT, update);
    // На случай, когда браузер не прислал событие online: пробуем раз в 20 секунд.
    const timer = setInterval(sync, 20_000);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", update);
      window.removeEventListener(QUEUE_EVENT, update);
      clearInterval(timer);
    };
  }, [sync, update]);

  const value = useMemo<ConnectionState>(() => {
    let status: ConnectionStatus = "online";
    if (failed.length) status = "error";
    else if (!online) status = "offline";
    else if (sending || pending.length) status = "sending";
    return { status, pending, failed, syncedAt, retry: sync, clearFailed: () => setFailed([]) };
  }, [failed, online, sending, pending, syncedAt, sync]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionState {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error("useConnection: нет ConnectionProvider выше по дереву");
  return value;
}
