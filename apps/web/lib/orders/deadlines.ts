// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee, type NotificationKind } from "@/lib/notify";
import { leadOverdueText, notAcceptedText, overdueText, remindText } from "@/lib/notify/messages";
import type { OrderPriority, OrderStatus } from "./types";

// ИИ-контроль сроков (п. 6.1 кейса). Вызывается раз в минуту расписанием базы через /api/cron/deadlines.
// Это код, а не модель: всё считается по времени и настройкам из таблицы settings.
//
// 1. Напоминание исполнителю за N минут до срока (по умолчанию 30) — один раз.
// 2. Просрочка: сообщение исполнителю и мастеру, повтор каждые N минут (по умолчанию 30).
// 3. Наряд не принят за 10 минут (аварийный — за 3): мастеру, со списком свободных исполнителей.
// 4. Длительная просрочка (по умолчанию 2 часа): руководителю — один раз.
// Что уже отправлено, смотрим в журнале notifications, поэтому каждую минуту ничего не дублируется.

// Наряд ещё не исполнен — значит, за его сроком следим.
const WATCHED: OrderStatus[] = ["issued", "accepted", "queued", "in_progress", "paused", "rework"];

const minutes = (ms: number) => Math.round(ms / 60000);

type SentNotification = { order_id: string | null; employee_id: string; kind: string; created_at: string };

// Журнал уже отправленного читаем целиком, страницами по 1000 строк: Supabase не отдаёт больше
// за один запрос. Раньше читалась только первая страница, и проверка не видела старые
// уведомления и слала их заново каждую минуту.
async function loadSentNotifications(
  db: ReturnType<typeof createAdminClient>,
  orderIds: string[],
): Promise<SentNotification[]> {
  const page = 1000;
  const rows: SentNotification[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from("notifications")
      .select("order_id, employee_id, kind, created_at")
      .in("order_id", orderIds)
      .order("id")
      .range(from, from + page - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < page) return rows;
  }
}

export async function runDeadlineChecks(now: Date = new Date()) {
  const db = createAdminClient();

  const [settingsRes, ordersRes, leadsRes, boardRes] = await Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db
      .from("work_orders")
      .select(
        `id, number, priority, status, description, due_at, assignee_id, master_id, created_at,
         equipment:equipment_id ( name ), section:section_id ( name ),
         assignee:employees!work_orders_assignee_id_fkey ( full_name )`,
      )
      .in("status", WATCHED),
    db.from("employees").select("id").eq("role", "lead"),
    db.from("worker_board").select("full_name, board_status"),
  ]);
  if (settingsRes.error || ordersRes.error) throw settingsRes.error ?? ordersRes.error;
  const settings = settingsRes.data;
  const orders = ordersRes.data;
  if (orders.length === 0) return { checked: 0, sent: 0 };

  const orderIds = orders.map((o) => o.id);
  const [notifications, eventsRes] = await Promise.all([
    loadSentNotifications(db, orderIds),
    db
      .from("work_order_events")
      .select("order_id, to_status, comment, reason, created_at")
      .in("order_id", orderIds)
      .order("created_at"),
  ]);
  const events = eventsRes.data ?? [];
  const freeWorkers = (boardRes.data ?? []).filter((w) => w.board_status === "free").map((w) => w.full_name ?? "");

  // Когда последний раз отправляли уведомление этого вида этому сотруднику по этому наряду.
  const lastSent = (orderId: string, employeeId: string, kind: NotificationKind): Date | null => {
    const times = notifications
      .filter((n) => n.order_id === orderId && n.employee_id === employeeId && n.kind === kind)
      .map((n) => new Date(n.created_at).getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  };

  let sent = 0;
  const send = async (employeeId: string, kind: NotificationKind, text: string, orderId: string) => {
    await notifyEmployee({ employeeId, kind, text, orderId });
    sent++;
  };

  for (const o of orders) {
    const orderEvents = events.filter((e) => e.order_id === o.id);
    const lastStatusEvent = [...orderEvents].reverse().find((e) => e.to_status === o.status);
    const statusSince = lastStatusEvent?.created_at ?? o.created_at;
    const lastComment = [...orderEvents].reverse().find((e) => e.comment || e.reason);
    const facts = {
      number: o.number,
      priority: o.priority as OrderPriority,
      status: o.status as OrderStatus,
      description: o.description,
      equipment: o.equipment?.name ?? "—",
      section: o.section?.name ?? "—",
      dueAt: o.due_at,
      workerName: o.assignee?.full_name ?? null,
    };
    const msToDue = new Date(o.due_at).getTime() - now.getTime();

    // 1. Напоминание до срока.
    if (o.assignee_id && msToDue > 0 && msToDue <= settings.remind_before_min * 60000) {
      if (!lastSent(o.id, o.assignee_id, "remind")) {
        await send(o.assignee_id, "remind", remindText(facts, minutes(msToDue)), o.id);
      }
    }

    // 2. Просрочка: исполнителю и мастеру, с повтором.
    if (msToDue < 0) {
      const late = minutes(-msToDue);
      const text = overdueText(facts, late, statusSince, lastComment?.comment ?? lastComment?.reason ?? null);
      for (const employeeId of [o.assignee_id, o.master_id]) {
        if (!employeeId) continue;
        const last = lastSent(o.id, employeeId, "overdue");
        if (!last || now.getTime() - last.getTime() >= settings.overdue_repeat_min * 60000) {
          await send(employeeId, "overdue", text, o.id);
        }
      }

      // 4. Длительная просрочка — руководителю.
      if (late >= settings.lead_escalate_after_min) {
        for (const lead of leadsRes.data ?? []) {
          if (!lastSent(o.id, lead.id, "lead_overdue")) await send(lead.id, "lead_overdue", leadOverdueText(facts, late), o.id);
        }
      }
    }

    // 3. Не принят вовремя — мастеру. Отсчёт от последней выдачи (переназначение начинает заново).
    if (o.status === "issued") {
      const timeout = o.priority === "emergency" ? settings.accept_timeout_urgent_min : settings.accept_timeout_min;
      const waited = now.getTime() - new Date(statusSince).getTime();
      const last = lastSent(o.id, o.master_id, "not_accepted");
      const alreadyForThisIssue = last && last.getTime() >= new Date(statusSince).getTime();
      if (waited >= timeout * 60000 && !alreadyForThisIssue) {
        const candidates = freeWorkers.filter((name) => name !== o.assignee?.full_name);
        await send(o.master_id, "not_accepted", notAcceptedText(facts, minutes(waited), candidates), o.id);
      }
    }
  }

  return { checked: orders.length, sent };
}
