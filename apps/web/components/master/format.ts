// Время показываем по часовому поясу завода, а не сервера или телефона.
const TIME_ZONE = "Asia/Qostanay";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

// Сколько минут наряд просрочен. Считаем только когда overdue уже true.
export function minutesLate(dueAt: string): number {
  return Math.round((Date.now() - new Date(dueAt).getTime()) / 60000);
}
