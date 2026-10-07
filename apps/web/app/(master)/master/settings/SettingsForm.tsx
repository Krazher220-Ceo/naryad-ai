// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useState } from "react";
import { Button, Card, Field, InlineNotice, NumberStepper, SegmentedControl } from "@/components/ui";
import { updateSettings } from "@/lib/orders/actions";
import { useT } from "@/components/LocaleProvider";

type SettingsData = {
  remind_before_min: number | null;
  accept_timeout_min: number | null;
  accept_timeout_urgent_min: number | null;
  overdue_repeat_min: number | null;
  lead_escalate_after_min: number | null;
  ai_provider: string | null;
};

export function SettingsForm({ initialSettings }: { initialSettings: SettingsData | null }) {
  const t = useT();
  const [remindBeforeMin, setRemindBeforeMin] = useState(initialSettings?.remind_before_min ?? 30);
  const [acceptTimeoutMin, setAcceptTimeoutMin] = useState(initialSettings?.accept_timeout_min ?? 10);
  const [acceptTimeoutUrgentMin, setAcceptTimeoutUrgentMin] = useState(initialSettings?.accept_timeout_urgent_min ?? 3);
  const [overdueRepeatMin, setOverdueRepeatMin] = useState(initialSettings?.overdue_repeat_min ?? 30);
  const [leadEscalateAfterMin, setLeadEscalateAfterMin] = useState(initialSettings?.lead_escalate_after_min ?? 120);
  const [aiProvider, setAiProvider] = useState<"cloud" | "local">(
    initialSettings?.ai_provider === "local" ? "local" : "cloud",
  );

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  function applyDemoPreset() {
    setRemindBeforeMin(1);
    setAcceptTimeoutMin(2);
    setAcceptTimeoutUrgentMin(1);
    setOverdueRepeatMin(2);
    setLeadEscalateAfterMin(5);
    setNotice(null);
  }

  function applyNormalPreset() {
    setRemindBeforeMin(30);
    setAcceptTimeoutMin(10);
    setAcceptTimeoutUrgentMin(3);
    setOverdueRepeatMin(30);
    setLeadEscalateAfterMin(120);
    setNotice(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const result = await updateSettings({
        remindBeforeMin,
        acceptTimeoutMin,
        acceptTimeoutUrgentMin,
        overdueRepeatMin,
        leadEscalateAfterMin,
        aiProvider,
      });
      setLoading(false);
      if (result.ok) {
        setNotice({ ok: true, message: t("settings.saved") });
      } else {
        setNotice({ ok: false, message: result.error });
      }
    } catch {
      setLoading(false);
      setNotice({ ok: false, message: t("orders.errors.unknown") });
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {notice && (
        <InlineNotice tone={notice.ok ? "success" : "danger"}>
          {notice.message}
        </InlineNotice>
      )}

      {/* Быстрые пресеты */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">{t("settings.presetsTitle")}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={applyDemoPreset}
            className="w-full"
          >
            {t("settings.demoPreset")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={applyNormalPreset}
            className="w-full"
          >
            {t("settings.normalPreset")}
          </Button>
        </div>
        <p className="text-base text-ink-muted">
          {t("settings.demoPresetHint")}
        </p>
      </Card>

      {/* Режим ИИ */}
      <Card className="flex flex-col gap-3">
        <Field label={t("settings.aiProvider")}>
          <SegmentedControl
            ariaLabel={t("settings.aiProvider")}
            value={aiProvider}
            onChange={(val) => setAiProvider(val as "cloud" | "local")}
            options={[
              { value: "cloud", label: t("settings.aiCloud") },
              { value: "local", label: t("settings.aiLocal") },
            ]}
          />
        </Field>
      </Card>

      {/* Числовые интервалы */}
      <Card className="flex flex-col gap-5">
        <Field label={t("settings.remindBefore")} hint={t("settings.remindBeforeHint")}>
          <NumberStepper
            min={1}
            max={360}
            value={remindBeforeMin}
            onChange={setRemindBeforeMin}
            label={t("settings.remindBefore")}
          />
        </Field>

        <Field label={t("settings.acceptTimeout")} hint={t("settings.acceptTimeoutHint")}>
          <NumberStepper
            min={1}
            max={360}
            value={acceptTimeoutMin}
            onChange={setAcceptTimeoutMin}
            label={t("settings.acceptTimeout")}
          />
        </Field>

        <Field label={t("settings.acceptTimeoutUrgent")} hint={t("settings.acceptTimeoutUrgentHint")}>
          <NumberStepper
            min={1}
            max={360}
            value={acceptTimeoutUrgentMin}
            onChange={setAcceptTimeoutUrgentMin}
            label={t("settings.acceptTimeoutUrgent")}
          />
        </Field>

        <Field label={t("settings.overdueRepeat")} hint={t("settings.overdueRepeatHint")}>
          <NumberStepper
            min={1}
            max={360}
            value={overdueRepeatMin}
            onChange={setOverdueRepeatMin}
            label={t("settings.overdueRepeat")}
          />
        </Field>

        <Field label={t("settings.leadEscalateAfter")} hint={t("settings.leadEscalateAfterHint")}>
          <NumberStepper
            min={1}
            max={1440}
            value={leadEscalateAfterMin}
            onChange={setLeadEscalateAfterMin}
            label={t("settings.leadEscalateAfter")}
          />
        </Field>
      </Card>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        fullWidth
      >
        {t("settings.save")}
      </Button>
    </form>
  );
}
