// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { cx } from "./cx";
import { IconAlert, IconCheck, IconWifiOff, IconX } from "./icons";

// Четыре всплывающих сообщения с едиными текстами (PLAN.md, раздел 8.2).
// На телефоне — сверху под шапкой, с вибрацией. На ПК — слева внизу, над блоком аккаунта.
//
// saved     «Сохранено»                                   исчезает через 3 с
// offline   «Нет сети. Действие сохранено…»               исчезает, когда появится связь
// needPhoto «Для внеплановых работ нужно фото «после»»     пока не закроют или не добавят фото
// error     «Не удалось сохранить…» и кнопка «Повторить»  пока не повторят или не закроют

export type ToastKind = "saved" | "offline" | "needPhoto" | "error";

type ShowOptions = {
  // Уточнение под основным текстом, например ответ сервера «Наряд уже отменён мастером».
  detail?: string;
  // Для error: что сделать по кнопке «Повторить».
  onRetry?: () => void;
};

type ToastApi = {
  show: (kind: ToastKind, options?: ShowOptions) => void;
  hide: (kind?: ToastKind) => void;
};

type ActiveToast = { kind: ToastKind; id: number } & ShowOptions;

const ToastContext = createContext<ToastApi | null>(null);

const STYLE: Record<ToastKind, string> = {
  saved: "border-success bg-surface",
  offline: "border-ink bg-line",
  needPhoto: "border-accent bg-surface",
  error: "border-danger bg-surface",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const counter = useRef(0);

  const hide = useCallback((kind?: ToastKind) => {
    setToast((current) => (!current || !kind || current.kind === kind ? null : current));
  }, []);

  const show = useCallback((kind: ToastKind, options?: ShowOptions) => {
    counter.current += 1;
    setToast({ kind, id: counter.current, ...options });
    // Вибрация — только для того, что требует внимания. На ПК и в iOS её нет, это не ошибка.
    if (kind !== "saved" && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(120);
    }
  }, []);

  // «Сохранено» исчезает само через 3 секунды.
  useEffect(() => {
    if (toast?.kind !== "saved") return;
    const timer = setTimeout(() => hide("saved"), 3000);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  // «Нет сети» исчезает, когда связь появилась.
  useEffect(() => {
    const onOnline = () => hide("offline");
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [hide]);

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div
          className={cx(
            "pointer-events-none fixed inset-x-0 z-50 px-4",
            "top-[calc(4.75rem+env(safe-area-inset-top))]",
            "lg:inset-x-auto lg:top-auto lg:bottom-80 lg:left-4 lg:w-64 lg:px-0",
          )}
        >
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto mx-auto flex max-w-xl items-start gap-3 rounded-2xl border-2 py-3 pl-4 pr-1 shadow-lg",
              STYLE[toast.kind],
            )}
          >
            <span className="pt-0.5">
              {toast.kind === "saved" && <IconCheck className="size-6 text-success" />}
              {toast.kind === "offline" && <IconWifiOff className="size-6 text-ink" />}
              {toast.kind === "needPhoto" && <IconAlert className="size-6 text-accent-ink" />}
              {toast.kind === "error" && <IconAlert className="size-6 text-danger" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-base font-semibold text-ink lg:text-sm">{t(`toast.${toast.kind}`)}</p>
              {toast.detail && <p className="text-sm text-ink-muted">{toast.detail}</p>}
              {toast.kind === "error" && toast.onRetry && (
                <button
                  type="button"
                  onClick={() => {
                    const retry = toast.onRetry;
                    hide("error");
                    retry?.();
                  }}
                  className="min-h-touch-sm self-start rounded-xl bg-danger px-4 text-base font-semibold text-white hover:bg-danger-hover"
                >
                  {t("toast.retry")}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => hide()}
              aria-label={t("ui.action.close")}
              className="flex size-touch-sm shrink-0 items-center justify-center rounded-lg text-ink active:bg-ink/10"
            >
              <IconX />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast: нет ToastProvider выше по дереву");
  return api;
}
