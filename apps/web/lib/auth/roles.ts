// Роли совпадают с типом employee_role в базе (supabase/migrations/0001_init.sql).
export const ROLES = ["master", "worker", "lead"] as const;
export type Role = (typeof ROLES)[number];

// Стартовый экран каждой роли.
export const ROLE_HOME: Record<Role, string> = {
  master: "/master",
  worker: "/worker",
  lead: "/lead",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// Логин превращается в служебный адрес для Supabase Auth: "ivanov" -> "ivanov@naryad.local".
export const LOGIN_EMAIL_DOMAIN = "naryad.local";

export function loginToEmail(login: string): string {
  return `${login.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
}
