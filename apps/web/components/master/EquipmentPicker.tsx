// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { IconCheck, IconChevronDown, IconChevronRight, cx } from "@/components/ui";
import type { IssueFormData } from "@/lib/orders/queries";

// Выбор оборудования «вкладка в вкладке» (PLAN.md, раздел 8.5): цех → группа → машина.
// Группа — тип оборудования внутри цеха (конвейеры, насосы…). Поиск в форме выдачи
// показывает плоский список; этот выбор — когда поиск пустой.
export function EquipmentPicker({
  sections,
  equipment,
  selectedId,
  openCount,
  onSelect,
}: {
  sections: IssueFormData["sections"];
  equipment: IssueFormData["equipment"];
  selectedId: string | null;
  openCount: Map<string, number>;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const selected = equipment.find((e) => e.id === selectedId);
  // Открыт цех и группа выбранной машины, иначе всё свёрнуто.
  const [openSection, setOpenSection] = useState<string | null>(selected?.section_id ?? null);
  const [openGroup, setOpenGroup] = useState<string | null>(selected ? `${selected.section_id}:${selected.type}` : null);

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const items = equipment.filter((e) => e.section_id === section.id);
        if (items.length === 0) return null;
        const isOpen = openSection === section.id;
        const groups = [...new Set(items.map((e) => e.type))];
        return (
          <div key={section.id} className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenSection(isOpen ? null : section.id)}
              className={cx(
                "flex min-h-touch items-center justify-between gap-2 rounded-xl px-4 text-left text-lg font-bold",
                isOpen ? "bg-brand text-white" : "border-2 border-line-strong bg-surface text-ink hover:bg-canvas",
              )}
            >
              <span>{section.name}</span>
              <span className="flex items-center gap-2 text-base font-semibold">
                {items.length}
                {isOpen ? <IconChevronDown className="size-5" /> : <IconChevronRight className="size-5" />}
              </span>
            </button>

            {isOpen &&
              groups.map((type) => {
                const key = `${section.id}:${type}`;
                const groupOpen = openGroup === key;
                const machines = items.filter((e) => e.type === type);
                return (
                  <div key={key} className="ml-4 flex flex-col gap-2">
                    <button
                      type="button"
                      aria-expanded={groupOpen}
                      onClick={() => setOpenGroup(groupOpen ? null : key)}
                      className="flex min-h-touch-sm items-center justify-between gap-2 rounded-xl bg-canvas px-4 text-left text-base font-semibold capitalize text-ink hover:bg-line"
                    >
                      <span>{type}</span>
                      <span className="flex items-center gap-2">
                        {machines.length}
                        {groupOpen ? <IconChevronDown className="size-5" /> : <IconChevronRight className="size-5" />}
                      </span>
                    </button>
                    {groupOpen &&
                      machines.map((e) => {
                        const isSelected = e.id === selectedId;
                        return (
                          <button
                            key={e.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => onSelect(e.id)}
                            className={cx(
                              "ml-4 flex min-h-touch items-center justify-between gap-2 rounded-xl border-2 px-4 text-left text-lg font-semibold",
                              isSelected ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
                            )}
                          >
                            <span>
                              {e.name} <span className="font-normal">· {e.inventory_no}</span>
                              {openCount.has(e.id) && (
                                <span className={cx("block text-base font-normal", isSelected ? "text-white" : "text-ink-muted")}>
                                  {t("master.issue.openOrdersBadge").replace("{n}", String(openCount.get(e.id)))}
                                </span>
                              )}
                            </span>
                            {isSelected && <IconCheck className="size-6 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
