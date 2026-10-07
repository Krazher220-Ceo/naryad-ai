// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, ConfirmSheet, Field, TextArea, useToast, VoiceButton, appendSpoken, cx } from "@/components/ui";
import { createSideRequest, requestHelp } from "@/lib/orders/actions";
import type { OrderDetails } from "@/lib/orders/queries";
import type { OrderStatus } from "@/lib/orders/types";

// Дополнения уровня 4 на карточке наряда исполнителя (PLAN.md, раздел 3).

// «Что взять с собой»: типовые материалы по шифру наряда.
export function ToBring({ faultCode, items }: { faultCode: string | null; items: OrderDetails["toBring"] }) {
  const t = useT();
  if (!faultCode || items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-bold text-ink">{t("worker.toBringTitle")}</h3>
      <p className="text-base text-ink-muted">{t("worker.toBringHint").replace("{code}", faultCode)}</p>
      <ul className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3">
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-base">
            <span className="text-ink">{m.name}</span>
            <span className="shrink-0 font-semibold text-ink">
              {t("worker.toBringItem").replace("{qty}", String(m.typical_qty)).replace("{unit}", m.unit)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// «Как чинили в прошлый раз»: последние закрытые наряды по этому оборудованию.
export function RepairHistory({ items }: { items: OrderDetails["repairHistory"] }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-bold text-ink">{t("worker.historyTitle")}</h3>
      {items.length === 0 ? (
        <p className="text-base text-ink-muted">{t("worker.historyEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((h) => (
            <li key={h.number} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-base">
              <span className="font-semibold text-ink">
                {t("worker.historyItem")
                  .replace("{number}", String(h.number))
                  .replace("{date}", h.closed_at ? new Date(h.closed_at).toLocaleDateString("ru-RU") : "—")}
              </span>
              {h.fault_code && (
                <span className="text-ink-muted">
                  {t("worker.historyFault").replace("{code}", `${h.fault_code}${h.fault_name ? ` · ${h.fault_name}` : ""}`)}
                </span>
              )}
              <span className="text-ink">{h.work_done || t("worker.historyNoWork")}</span>
              {h.materials && <span className="text-ink-muted">{t("worker.historyMaterials").replace("{list}", h.materials)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Проверка безопасности перед началом работ: все пункты отмечены — можно начинать.
export function SafetySheet({
  open,
  needsPermit,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  needsPermit: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const items: ("stopped" | "locked" | "ppe" | "permit")[] = ["stopped", "locked", "ppe", ...(needsPermit ? (["permit"] as const) : [])];
  const [checked, setChecked] = useState<string[]>([]);
  const allChecked = items.every((i) => checked.includes(i));

  return (
    <ConfirmSheet
      open={open}
      title={t("safety.title")}
      description={t("safety.text")}
      confirmLabel={t("safety.submit")}
      confirmDisabled={!allChecked}
      loading={loading}
      onConfirm={() => {
        setChecked([]);
        onConfirm();
      }}
      onCancel={() => {
        setChecked([]);
        onCancel();
      }}
    >
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const on = checked.includes(item);
          return (
            <li key={item}>
              <label
                className={cx(
                  "flex min-h-touch cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2 text-base font-semibold",
                  on ? "border-success bg-success-soft text-ink" : "border-line-strong bg-surface text-ink",
                )}
              >
                <input
                  type="checkbox"
                  className="size-6 shrink-0 accent-current"
                  checked={on}
                  onChange={() => setChecked((prev) => (on ? prev.filter((x) => x !== item) : [...prev, item]))}
                />
                {t(`safety.${item}`)}
              </label>
            </li>
          );
        })}
      </ul>
    </ConfirmSheet>
  );
}

// Наряд в работе у исполнителя: можно позвать мастера и отправить попутную находку.
const ACTIVE: OrderStatus[] = ["accepted", "queued", "in_progress", "paused", "rework"];

export function WorkerHelpActions({ orderId, equipmentId, status }: { orderId: string; equipmentId: string; status: OrderStatus }) {
  const t = useT();
  const [sheet, setSheet] = useState<"help" | "side" | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  // Повтор после сбоя связи не создаст второе событие «Нужна помощь».
  const helpActionId = useRef<string | null>(null);

  if (!ACTIVE.includes(status)) return null;

  function close() {
    setSheet(null);
    setText("");
  }

  async function submit() {
    setLoading(true);
    try {
      if (sheet === "help") {
        helpActionId.current ??= crypto.randomUUID();
        const res = await requestHelp({ orderId, comment: text.trim() || undefined, clientActionId: helpActionId.current });
        if (!res.ok) return toast.show("error", { detail: res.error });
        helpActionId.current = null;
        toast.show("saved", { detail: t("help.sent") });
      } else {
        const res = await createSideRequest({ orderId, equipmentId, description: text });
        if (!res.ok) return toast.show("error", { detail: res.error });
        toast.show("saved", { detail: t("sideRequest.sent") });
      }
      close();
    } catch {
      toast.show("error");
    } finally {
      setLoading(false);
    }
  }

  const isHelp = sheet === "help";
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => setSheet("help")}>
          {t("help.button")}
        </Button>
        <Button variant="secondary" onClick={() => setSheet("side")}>
          {t("sideRequest.button")}
        </Button>
      </div>
      <ConfirmSheet
        open={sheet !== null}
        title={isHelp ? t("help.title") : t("sideRequest.title")}
        description={isHelp ? t("help.text") : t("sideRequest.text")}
        confirmLabel={isHelp ? t("help.submit") : t("sideRequest.submit")}
        confirmDisabled={!isHelp && !text.trim()}
        loading={loading}
        onConfirm={submit}
        onCancel={close}
      >
        <Field label={isHelp ? t("help.commentLabel") : t("sideRequest.label")} htmlFor="extra-text" required={!isHelp}>
          <TextArea
            id="extra-text"
            rows={3}
            placeholder={isHelp ? t("help.commentPlaceholder") : t("sideRequest.placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <VoiceButton onText={(spoken) => setText((prev) => appendSpoken(prev, spoken))} />
        </Field>
      </ConfirmSheet>
    </>
  );
}
