// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Что стоит за кодом из QR: машина или цех. Нужен экранам оператора без входа,
// поэтому читаем служебным клиентом. Отдаём только справочные данные, без имён людей.

const OPEN = ["issued", "accepted", "queued", "in_progress", "paused", "rework"] as const;

// В QR и на табличке только буквы, цифры и дефис. Остальное отбрасываем: строка идёт в фильтр.
export function cleanCode(raw: string): string {
  return decodeURIComponent(raw).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export type EquipmentTarget = {
  kind: "equipment";
  code: string;
  equipment: { id: string; name: string; inventoryNo: string; type: string; sectionName: string };
  // Открытый наряд по машине: оператор видит предупреждение о дубле.
  openOrderNumber: number | null;
  // Заявка по машине, которая уже ждёт мастера.
  pendingRequestNumber: number | null;
};

export type SectionTarget = {
  kind: "section";
  code: string;
  section: { id: string; name: string };
  // Машины цеха, сгруппированные по типу (группа внутри цеха).
  groups: { type: string; machines: { id: string; name: string; code: string; inventoryNo: string; open: boolean }[] }[];
};

export async function resolveCode(raw: string): Promise<EquipmentTarget | SectionTarget | null> {
  const code = cleanCode(raw);
  if (!code) return null;
  const db = createAdminClient();

  const { data: eq } = await db
    .from("equipment")
    .select("id, name, inventory_no, type, qr_code, section:section_id ( name )")
    .or(`qr_code.eq.${code},inventory_no.eq.${code}`)
    .limit(1)
    .maybeSingle();

  if (eq) {
    const [{ data: order }, { data: request }] = await Promise.all([
      db.from("work_orders").select("number").eq("equipment_id", eq.id).in("status", [...OPEN]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("requests").select("number").eq("equipment_id", eq.id).eq("status", "new").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return {
      kind: "equipment",
      code: eq.qr_code ?? code,
      equipment: { id: eq.id, name: eq.name, inventoryNo: eq.inventory_no, type: eq.type, sectionName: eq.section?.name ?? "" },
      openOrderNumber: order?.number ?? null,
      pendingRequestNumber: request?.number ?? null,
    };
  }

  const { data: section } = await db.from("sections").select("id, name, qr_code").eq("qr_code", code).maybeSingle();
  if (!section) return null;

  const [{ data: machines }, { data: open }] = await Promise.all([
    db.from("equipment").select("id, name, inventory_no, type, qr_code").eq("section_id", section.id).order("name"),
    db.from("work_orders").select("equipment_id").eq("section_id", section.id).in("status", [...OPEN]),
  ]);
  const openIds = new Set((open ?? []).map((o) => o.equipment_id));
  const byType = new Map<string, SectionTarget["groups"][number]["machines"]>();
  for (const m of machines ?? []) {
    const list = byType.get(m.type) ?? [];
    list.push({ id: m.id, name: m.name, code: m.qr_code ?? m.inventory_no, inventoryNo: m.inventory_no, open: openIds.has(m.id) });
    byType.set(m.type, list);
  }
  return {
    kind: "section",
    code,
    section: { id: section.id, name: section.name },
    groups: [...byType.entries()].map(([type, list]) => ({ type, machines: list })),
  };
}
