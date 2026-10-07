// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Роли совпадают с типом employee_role в базе (supabase/migrations/0001_init.sql).
export const ROLES = ["master", "worker", "lead", "operator"] as const;
export type Role = (typeof ROLES)[number];

// Стартовый экран каждой роли.
export const ROLE_HOME: Record<Role, string> = {
  master: "/master",
  worker: "/worker",
  lead: "/lead",
  // Оператор с общим логином участка. Без входа оператор попадает сюда же.
  operator: "/operator",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// Логин превращается в служебный адрес для Supabase Auth: "ivanov" -> "ivanov@naryad.local".
export const LOGIN_EMAIL_DOMAIN = "naryad.local";

export function loginToEmail(login: string): string {
  return `${login.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
}

// Демо-логины для жюри опубликованы на /demo и в README. Пароль у них не меняется и не сбрасывается,
// иначе любой проверяющий может закрыть вход остальным.
export const DEMO_LOGINS = ["master1", "worker1", "worker2", "worker3", "lead1", "operator1"] as const;

export function isDemoLogin(login: string | null | undefined): boolean {
  return typeof login === "string" && (DEMO_LOGINS as readonly string[]).includes(login);
}
