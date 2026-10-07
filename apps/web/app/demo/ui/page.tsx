// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useCallback, useState } from "react";
import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { REJECT_REASONS } from "@/lib/orders/transitions";
import {
  BottomActionBar,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  ListItem,
  NumberStepper,
  ORDER_STATUSES,
  OverdueTag,
  PhotoPicker,
  PRIORITIES,
  PriorityBadge,
  ReasonPicker,
  SegmentedControl,
  Select,
  Skeleton,
  StatusBadge,
  StepForm,
  TextArea,
  TextInput,
  Toast,
  WorkerChip,
  isReasonValid,
  type Priority,
  type ReasonValue,
  type WorkType,
} from "@/components/ui";

// Витрина дизайн-системы: все компоненты во всех состояниях. Данные демонстрационные.

const swatches: { key: MessageKey; className: string; token: string }[] = [
  { key: "ui.demo.colorCanvas", className: "bg-canvas", token: "canvas" },
  { key: "ui.demo.colorSurface", className: "bg-surface", token: "surface" },
  { key: "ui.demo.colorInk", className: "bg-ink", token: "ink" },
  { key: "ui.demo.colorInkMuted", className: "bg-ink-muted", token: "ink-muted" },
  { key: "ui.demo.colorBrand", className: "bg-brand", token: "brand" },
  { key: "ui.demo.colorAccent", className: "bg-accent", token: "accent" },
  { key: "ui.demo.colorDanger", className: "bg-danger", token: "danger" },
  { key: "ui.demo.colorSuccess", className: "bg-success", token: "success" },
];

const FAULT_CODES = [
  { value: "M-01", key: "ui.demo.code1" },
  { value: "M-02", key: "ui.demo.code2" },
  { value: "E-05", key: "ui.demo.code3" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b-2 border-ink pb-2 text-2xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function UiDemoPage() {
  const t = useT();
  const faultCodes = FAULT_CODES.map((c) => ({ value: c.value, label: t(c.key) }));
  const [workType, setWorkType] = useState<WorkType | null>("unplanned");
  const [priority, setPriority] = useState<Priority | null>("normal");
  const [qty, setQty] = useState(2);
  const [kg, setKg] = useState(0.5);
  const [reason, setReason] = useState<ReasonValue>({ code: "", text: "" });
  const [reasonTried, setReasonTried] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Состояние формы закрытия наряда
  const [works, setWorks] = useState("");
  const [code, setCode] = useState("");
  const [usedQty, setUsedQty] = useState(1);
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [comment, setComment] = useState("");

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="h-1 bg-accent" />
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-base font-bold uppercase tracking-wider text-accent-ink">{t("app.name")}</p>
          <h1 className="text-2xl font-bold text-ink">{t("ui.demo.title")}</h1>
          <p className="text-base text-ink-muted">{t("ui.demo.subtitle")}</p>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-6 pb-40">
        <Section title={t("ui.demo.sections.colors")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {swatches.map((s) => (
              <div key={s.token} className="flex flex-col gap-1">
                <div className={`h-14 rounded-xl border border-line ${s.className}`} />
                <span className="text-base font-semibold text-ink">{t(s.key)}</span>
                <code className="text-base text-ink-muted">{s.token}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("ui.demo.sections.buttons")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button fullWidth>{t("orders.action.accept")}</Button>
            <Button variant="secondary" fullWidth>{t("orders.action.queue")}</Button>
            <Button variant="danger" fullWidth>{t("orders.action.reject")}</Button>
            <Button variant="ghost" fullWidth>{t("ui.demo.ghost")}</Button>
            <Button fullWidth loading>{t("ui.demo.loading")}</Button>
            <Button fullWidth disabled>{t("ui.demo.disabled")}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="md">{t("orders.action.start")}</Button>
            <Button size="md" variant="secondary">{t("orders.action.pause")}</Button>
            <Button size="md" variant="danger">{t("ui.action.cancel")}</Button>
          </div>
        </Section>

        <Section title={t("ui.demo.sections.badges")}>
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <PriorityBadge key={p} priority={p} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <OverdueTag minutesLate={25} />
            <OverdueTag minutesLate={130} />
          </div>
        </Section>

        <Section title={t("ui.demo.sections.workers")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <WorkerChip name={t("ui.demo.workerName1")} state="free" />
            <WorkerChip name={t("ui.demo.workerName2")} state="busy" orderNumber={1042} />
            <WorkerChip name={t("ui.demo.workerName3")} state="queue" queueCount={2} />
            <WorkerChip name={t("ui.demo.workerName4")} state="off" />
          </div>
        </Section>

        <Section title={t("ui.demo.sections.list")}>
          <div className="flex flex-col gap-2">
            <ListItem
              tone="emergency"
              title={t("ui.demo.order1Title")}
              subtitle={t("ui.demo.order1Place")}
              badges={
                <>
                  <PriorityBadge priority="emergency" />
                  <StatusBadge status="issued" />
                  <OverdueTag minutesLate={12} />
                </>
              }
              meta="№1042"
              onClick={() => setToast(t("ui.demo.order1Title"))}
            />
            <ListItem
              title={t("ui.demo.order2Title")}
              subtitle={t("ui.demo.order2Place")}
              badges={
                <>
                  <PriorityBadge priority="high" />
                  <StatusBadge status="in_progress" />
                </>
              }
              meta="14:30"
              href="/demo/ui"
            />
            <ListItem
              title={t("ui.demo.order3Title")}
              subtitle={t("ui.demo.order3Place")}
              badges={
                <>
                  <PriorityBadge priority="planned" />
                  <StatusBadge status="queued" />
                </>
              }
              meta="16:00"
            />
          </div>
          <Card tone="emergency">
            <div className="flex flex-col gap-3">
              <PriorityBadge priority="emergency" />
              <p className="text-xl font-bold text-ink">{t("ui.demo.order1Title")}</p>
              <p className="text-base text-ink-muted">{t("ui.demo.order1Place")}</p>
            </div>
          </Card>
        </Section>

        <Section title={t("ui.demo.sections.fields")}>
          <Field label={t("ui.demo.fieldEquipment")} htmlFor="demo-eq" required>
            <Select id="demo-eq" options={faultCodes} defaultValue="" />
          </Field>
          <Field
            label={t("ui.demo.fieldDescription")}
            htmlFor="demo-desc"
            hint={t("ui.demo.fieldDescriptionHint")}
            required
          >
            <TextInput id="demo-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field
            label={t("ui.demo.fieldDescription")}
            htmlFor="demo-desc-err"
            error={t("ui.demo.fieldDescriptionError")}
            required
          >
            <TextInput id="demo-desc-err" invalid />
          </Field>
          <Field label={t("ui.demo.fieldComment")} htmlFor="demo-comment">
            <TextArea id="demo-comment" />
          </Field>
        </Section>

        <Section title={t("ui.demo.sections.segmented")}>
          <Field label={t("ui.demo.fieldWorkType")}>
            <SegmentedControl<WorkType>
              ariaLabel={t("ui.demo.fieldWorkType")}
              value={workType}
              onChange={setWorkType}
              options={[
                { value: "planned", label: t("orders.type.planned") },
                { value: "unplanned", label: t("orders.type.unplanned") },
              ]}
            />
          </Field>
          <Field label={t("ui.demo.fieldPriority")}>
            <SegmentedControl<Priority>
              ariaLabel={t("ui.demo.fieldPriority")}
              value={priority}
              onChange={setPriority}
              options={PRIORITIES.map((p) => ({
                value: p,
                label: t(`orders.priority.${p}`),
                tone: p === "emergency" ? "danger" : "default",
              }))}
            />
          </Field>
        </Section>

        <Section title={t("ui.demo.sections.stepper")}>
          <Field label={t("ui.demo.material")} htmlFor="demo-qty">
            <NumberStepper id="demo-qty" label={t("ui.demo.material")} value={qty} onChange={setQty} />
          </Field>
          <Field label={t("ui.demo.materialKg")} htmlFor="demo-kg">
            <NumberStepper id="demo-kg" label={t("ui.demo.materialKg")} value={kg} onChange={setKg} step={0.1} />
          </Field>
        </Section>

        <Section title={t("ui.demo.sections.reason")}>
          <ReasonPicker codes={REJECT_REASONS} value={reason} onChange={setReason} showError={reasonTried} />
          <Button
            variant="danger"
            onClick={() => {
              setReasonTried(true);
              if (isReasonValid(reason)) setToast(t("ui.notice.saved"));
            }}
          >
            {t("orders.action.reject")}
          </Button>
        </Section>

        <Section title={t("ui.demo.sections.photo")}>
          <PhotoPicker value={photos} onChange={setPhotos} />
        </Section>

        <Section title={t("ui.demo.sections.states")}>
          <EmptyState
            title={t("ui.empty.ordersTitle")}
            text={t("ui.empty.ordersText")}
          />
          <ErrorState onRetry={() => setToast(t("ui.action.retry"))} />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-18" />
            <Skeleton className="h-18" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </Section>

        <Section title={t("ui.demo.sections.notices")}>
          <InlineNotice tone="offline">{t("ui.notice.offline")}</InlineNotice>
          <InlineNotice tone="success">{t("ui.notice.saved")}</InlineNotice>
          <InlineNotice tone="warning">{t("orders.afterPhotoRequired")}</InlineNotice>
          <InlineNotice
            tone="danger"
            action={
              <Button size="md" variant="secondary" className="self-start">
                {t("ui.action.retry")}
              </Button>
            }
          >
            {t("ui.notice.error")}
          </InlineNotice>
          <Button variant="secondary" onClick={() => setToast(t("ui.notice.saved"))}>
            {t("ui.demo.showToast")}
          </Button>
        </Section>

        <Section title={t("ui.demo.sections.sheet")}>
          <Button variant="danger" onClick={() => setSheetOpen(true)}>
            {t("orders.action.reject")}
          </Button>
        </Section>

        <Section title={t("ui.demo.sections.stepForm")}>
          <StepForm
            submitLabel={t("ui.action.submit")}
            onSubmit={() => setToast(t("ui.demo.submitted"))}
            steps={[
              {
                id: "works",
                title: t("ui.demo.stepWorks"),
                valid: works.trim().length > 0,
                content: (
                  <Field label={t("ui.demo.worksDone")} htmlFor="close-works" required>
                    <TextArea id="close-works" value={works} onChange={(e) => setWorks(e.target.value)} />
                  </Field>
                ),
              },
              {
                id: "code",
                title: t("ui.demo.stepCode"),
                valid: code !== "",
                content: (
                  <Field label={t("ui.demo.faultCode")} htmlFor="close-code" required>
                    <Select id="close-code" options={faultCodes} value={code} onChange={(e) => setCode(e.target.value)} />
                  </Field>
                ),
              },
              {
                id: "materials",
                title: t("ui.demo.stepMaterials"),
                content: (
                  <Field label={t("ui.demo.material")} htmlFor="close-qty">
                    <NumberStepper id="close-qty" label={t("ui.demo.material")} value={usedQty} onChange={setUsedQty} />
                  </Field>
                ),
              },
              {
                id: "photo",
                title: t("ui.demo.stepPhoto"),
                valid: afterPhotos.length > 0,
                content: (
                  <>
                    <InlineNotice tone="warning">{t("orders.afterPhotoRequired")}</InlineNotice>
                    <PhotoPicker value={afterPhotos} onChange={setAfterPhotos} />
                  </>
                ),
              },
              {
                id: "comment",
                title: t("ui.demo.stepComment"),
                content: (
                  <Field label={t("ui.demo.fieldComment")} htmlFor="close-comment">
                    <TextArea id="close-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                  </Field>
                ),
              },
            ]}
          />
        </Section>
      </main>

      {/* Пример главного действия. На телефоне форма по шагам показывает свою панель, поэтому эта — только от md. */}
      <BottomActionBar className="hidden md:block">
        <Button fullWidth onClick={() => setToast(t("ui.notice.saved"))}>
          {t("master.issueOrder")}
        </Button>
      </BottomActionBar>

      <ConfirmSheet
        open={sheetOpen}
        tone="danger"
        title={t("ui.demo.sheetTitle")}
        description={t("ui.demo.sheetText")}
        confirmLabel={t("orders.action.reject")}
        confirmDisabled={!isReasonValid(reason)}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => {
          setSheetOpen(false);
          setToast(t("ui.notice.saved"));
        }}
      >
        <ReasonPicker codes={REJECT_REASONS} value={reason} onChange={setReason} />
      </ConfirmSheet>

      <Toast open={toast !== null} message={toast ?? ""} onClose={closeToast} />
    </div>
  );
}
