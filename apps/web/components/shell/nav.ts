import type { MessageKey } from "@/lib/i18n";
import type { Role } from "@/lib/auth/roles";

// Разделы каждой роли. Один список на телефон и ПК:
// phone — три кнопки нижнего меню (средняя крупная), pc — пункты тёмного меню слева.
// Набросок: PLAN.md, раздел 8.1.

export type NavIcon = "orders" | "scan" | "user" | "chart" | "plus" | "chat" | "warning";

export type NavItem = {
  href: string;
  label: MessageKey;
  icon: NavIcon;
  // Пункт подсвечивается только при точном совпадении адреса (для стартовых экранов роли).
  exact?: boolean;
};

export type RoleNav = {
  phone: [NavItem, NavItem, NavItem];
  pc: NavItem[];
};

const PROFILE: NavItem = { href: "/profile", label: "shell.nav.profile", icon: "user" };

export const NAV: Record<Role, RoleNav> = {
  worker: {
    phone: [
      { href: "/worker", label: "shell.nav.orders", icon: "orders", exact: true },
      { href: "/worker/scan", label: "shell.nav.scan", icon: "scan" },
      PROFILE,
    ],
    pc: [
      { href: "/worker", label: "shell.nav.myOrders", icon: "orders", exact: true },
      { href: "/worker/scan", label: "shell.nav.scan", icon: "scan" },
      PROFILE,
    ],
  },
  master: {
    phone: [
      { href: "/master", label: "shell.nav.shift", icon: "orders", exact: true },
      { href: "/master/orders/new", label: "shell.nav.issue", icon: "plus" },
      { href: "/master/assistant", label: "shell.nav.assistant", icon: "chat" },
    ],
    pc: [
      { href: "/master", label: "shell.nav.board", icon: "orders", exact: true },
      { href: "/master/orders/new", label: "shell.nav.issueOrder", icon: "plus" },
      { href: "/master/shift", label: "shell.nav.shiftReport", icon: "chart" },
      { href: "/master/rating", label: "shell.nav.rating", icon: "chart" },
      { href: "/master/anomalies", label: "shell.nav.anomalies", icon: "warning" },
      { href: "/master/assistant", label: "shell.nav.assistant", icon: "chat" },
      { href: "/master/equipment/qr", label: "shell.nav.qr", icon: "scan" },
      { href: "/master/settings", label: "shell.nav.settings", icon: "user" },
      PROFILE,
    ],
  },
  lead: {
    phone: [
      { href: "/lead", label: "shell.nav.summary", icon: "chart", exact: true },
      { href: "/lead/anomalies", label: "shell.nav.anomalies", icon: "warning" },
      PROFILE,
    ],
    pc: [
      { href: "/lead", label: "shell.nav.dashboard", icon: "chart", exact: true },
      { href: "/lead/anomalies", label: "shell.nav.anomalies", icon: "warning" },
      { href: "/lead/materials", label: "shell.nav.materials", icon: "chart" },
      { href: "/lead/downtime", label: "shell.nav.downtime", icon: "chart" },
      { href: "/lead/shift", label: "shell.nav.shiftReport", icon: "chart" },
      { href: "/lead/rating", label: "shell.nav.rating", icon: "chart" },
      PROFILE,
    ],
  },
};

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// На экранах одного наряда нижнего меню нет: внизу одно главное действие на всю ширину.
export function hidesBottomNav(pathname: string): boolean {
  return /^\/(worker|master)\/orders\//.test(pathname);
}

// Заголовок в шапке телефона: пункт меню, на котором стоим, или название экрана наряда.
export function pageTitle(role: Role, pathname: string): MessageKey {
  if (pathname === "/master/orders/new") return "shell.titles.newOrder";
  if (/\/orders\/[^/]+\/close$/.test(pathname)) return "shell.titles.closeOrder";
  if (/\/orders\/[^/]+$/.test(pathname)) return "shell.titles.order";
  if (pathname.startsWith("/notifications")) return "shell.nav.notifications";
  const match = NAV[role].pc.find((item) => isActive(item, pathname));
  return match?.label ?? "app.name";
}
