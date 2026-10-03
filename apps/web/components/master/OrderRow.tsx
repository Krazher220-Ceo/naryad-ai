import { ListItem, OverdueTag, PriorityBadge, StatusBadge } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { MasterBoard } from "@/lib/orders/queries";
import { formatTime, minutesLate } from "./format";
import { EquipmentIcon } from "@/components/equipment/EquipmentIcon";

type BoardOrder = MasterBoard["orders"][number];

// Строка наряда на панели мастера. Нажатие открывает карточку.
export function OrderRow({ order }: { order: BoardOrder }) {
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
