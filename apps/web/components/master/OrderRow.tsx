import Link from "next/link";
import { ListItem, OverdueTag, PriorityBadge, StatusBadge, cx } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import type { MasterBoard } from "@/lib/orders/queries";
import { formatTime, minutesLate } from "./format";
import { EquipmentIcon } from "@/components/equipment/EquipmentIcon";

type BoardOrder = MasterBoard["orders"][number];

// Строка наряда на панели мастера. Нажатие открывает карточку.
export async function OrderRow({ order }: { order: BoardOrder }) {
  const t = await getT();
  const place = [order.equipment?.name, order.section?.name].filter(Boolean).join(" · ");
  const assignee = order.assignee?.full_name ?? t("master.noAssignee");

  return (
    <ListItem
      href={`/master/orders/${order.id}`}
      tone={order.priority === "emergency" ? "emergency" : "default"}
      icon={order.equipment ? <EquipmentIcon type={order.equipment.type} className="size-6" /> : undefined}
      title={order.description}
      subtitle={`${place} · ${assignee}`}
      meta={formatTime(order.due_at)}
      badges={
        <>
          <PriorityBadge priority={order.priority} />
          <StatusBadge status={order.status} />
          {order.overdue && <OverdueTag minutesLate={minutesLate(order.due_at)} />}
        </>
      }
    />
  );
}

// Компактная карточка для колонок доски на ПК: заголовок в 2 строки, одна строка места, бейджи внутри.
export async function OrderCard({ order }: { order: BoardOrder }) {
  const t = await getT();
  const place = [order.equipment?.name, order.section?.name].filter(Boolean).join(" · ");
  const assignee = order.assignee?.full_name ?? t("master.noAssignee");
  const emergency = order.priority === "emergency";

  return (
    <Link
      href={`/master/orders/${order.id}`}
      className={cx(
        "flex min-w-0 flex-col gap-1.5 rounded-xl bg-surface p-2.5 hover:bg-canvas active:bg-line",
        emergency ? "border-2 border-l-8 border-danger" : "border border-line",
      )}
    >
      <span className="line-clamp-2 text-sm leading-snug font-semibold text-ink">
        {order.description}
      </span>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
        {order.equipment && (
          <EquipmentIcon type={order.equipment.type} className="size-3.5 shrink-0 text-ink" />
        )}
        <span className="min-w-0 flex-1 truncate">{`${place} · ${assignee}`}</span>
        <span className="shrink-0 font-semibold text-ink">{formatTime(order.due_at)}</span>
      </div>
      <div className="flex flex-wrap gap-1 [&>span]:min-h-6 [&>span]:max-w-full [&>span]:gap-1 [&>span]:whitespace-normal [&>span]:px-1.5 [&>span]:text-xs [&_svg]:size-3.5">
        <PriorityBadge priority={order.priority} />
        <StatusBadge status={order.status} />
        {order.overdue && <OverdueTag minutesLate={minutesLate(order.due_at)} />}
      </div>
    </Link>
  );
}
