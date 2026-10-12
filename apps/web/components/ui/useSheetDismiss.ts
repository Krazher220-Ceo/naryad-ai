// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect, useRef, useState } from "react";

// Как закрыть нижний лист, кроме крестика и тапа по фону:
// 1. Кнопка «Назад» телефона: при открытии добавляем запись в историю, «Назад» её снимает и закрывает лист.
// 2. Свайп вниз за верхнюю часть листа: протянули больше 80 px — закрываем, меньше — лист возвращается.
const CLOSE_DISTANCE = 80;

const isOurEntry = () => Boolean((history.state as { naryadSheet?: boolean } | null)?.naryadSheet);

export function useSheetDismiss(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    history.pushState({ naryadSheet: true }, "");
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Лист закрыла программа (например, после подтверждения действия): снимаем метку, но назад
      // не идём — следом может начаться переход на другую страницу.
      if (isOurEntry()) history.replaceState({ ...history.state, naryadSheet: false }, "");
    };
  }, [open]);

  // Пользователь закрыл лист сам (крестик, фон, свайп, Escape): снимаем свою запись из истории,
  // «Назад» вызовет onClose через popstate.
  const dismiss = () => {
    if (isOurEntry()) history.back();
    else closeRef.current();
  };

  const startY = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dragProps = {
    onPointerDown: (e: React.PointerEvent) => {
      startY.current = e.clientY;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (startY.current === null) return;
      setOffset(Math.max(0, e.clientY - startY.current));
    },
    onPointerUp: () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (offset > CLOSE_DISTANCE) dismiss();
      setOffset(0);
    },
    onPointerCancel: () => {
      startY.current = null;
      setDragging(false);
      setOffset(0);
    },
  };

  // Пока тянем — лист едет за пальцем без анимации, отпустили — плавно возвращается.
  const sheetStyle: React.CSSProperties = {
    transform: offset ? `translateY(${offset}px)` : undefined,
    transition: dragging ? "none" : "transform 0.2s ease-out",
  };

  return { dragProps, sheetStyle, dismiss };
}
