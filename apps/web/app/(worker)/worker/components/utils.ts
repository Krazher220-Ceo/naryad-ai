// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Вспомогательные функции для экранов исполнителя

export function formatOrderTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

export function getOverdueMinutes(order: { overdue?: boolean; due_at: string }): number | undefined {
  if (!order.overdue) return undefined;
  const minutes = Math.round((Date.now() - new Date(order.due_at).getTime()) / 60000);
  return minutes > 0 ? minutes : 1;
}
