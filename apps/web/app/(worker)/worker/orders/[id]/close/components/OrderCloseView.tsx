// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { sendComplete } from "@/lib/offline/queue";
import type { OrderDetails, CloseFormData } from "@/lib/orders/queries";
import type { CurrentEmployee } from "@/lib/auth/session";
import {
  StepForm,
  Field,
  TextArea,
  VoiceButton,
  appendSpoken,
  Select,
  NumberStepper,
  PhotoPicker,
  InlineNotice,
  EmptyState,
  Button,
  IconChevronLeft,
  useToast,
  type Step,
} from "@/components/ui";

type OrderCloseViewProps = {
  order: OrderDetails["order"];
  faultCodes: CloseFormData["faultCodes"];
  allMaterials: CloseFormData["materials"];
  employee: CurrentEmployee;
  // Первое фото «до»: показывается как ориентир, чтобы снять «после» с того же ракурса.
  beforePhotoUrl: string | null;
};

type SelectedMaterial = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  // Норма из справочника (typical_qty). Больше нормы на 30% и более — предупреждение.
  norm: number;
};

export function OrderCloseView({
  order,
  faultCodes,
  allMaterials,
  employee,
  beforePhotoUrl,
}: OrderCloseViewProps) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();

  // Шаг 1: Работы
  const [workDone, setWorkDone] = useState(order.work_done ?? "");

  // Шаг 2: Шифр неисправности
  const [faultCode, setFaultCode] = useState(order.fault_code ?? "");

  // Шаг 3: Материалы
  const [materials, setMaterials] = useState<SelectedMaterial[]>(() => {
    if (!order.fault_code) return [];
    const typical = allMaterials.filter((m) => m.fault_codes?.includes(order.fault_code!));
    return typical.map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      qty: m.typical_qty ?? 1,
      norm: m.typical_qty ?? 1,
    }));
  });
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);

  // Шаг 4: Фото «после»
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);

  // Шаг 5: Комментарий
  const [comment, setComment] = useState("");

  // Ошибки и загрузка
  const [loading, setLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Idempotency: сохранение clientActionId
  const clientActionIdRef = useRef<string | null>(null);


  // При выборе или смене шифра подставляем типовые материалы для этого шифра
  function handleFaultCodeChange(newCode: string) {
    setFaultCode(newCode);

    if (!newCode) {
      setMaterials([]);
      return;
    }

    const typical = allMaterials.filter((m) => m.fault_codes?.includes(newCode));
    const newMaterials: SelectedMaterial[] = typical.map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      qty: m.typical_qty ?? 1,
      norm: m.typical_qty ?? 1,
    }));

    setMaterials(newMaterials);
  }

  function handleQtyChange(id: string, qty: number) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, qty } : m)),
    );
  }

  function handleAddMaterial(materialId: string) {
    if (!materialId) return;
    const found = allMaterials.find((m) => m.id === materialId);
    if (!found) return;

    setMaterials((prev) => [
      ...prev,
      {
        id: found.id,
        name: found.name,
        unit: found.unit,
        qty: found.typical_qty ?? 1,
        norm: found.typical_qty ?? 1,
      },
    ]);
    setIsAddingMaterial(false);
  }

  // Доступные для добавления материалы (которых ещё нет в списке)
  const availableMaterials = allMaterials.filter(
    (m) => !materials.some((sm) => sm.id === m.id),
  );

  // Отправка формы закрытия наряда. Нет сети — фото и действие сохраняются на телефоне
  // и уйдут сами, когда связь появится (lib/offline/queue.ts).
  async function handleSubmit() {
    const clientActionId = clientActionIdRef.current || crypto.randomUUID();
    clientActionIdRef.current = clientActionId;

    setLoading(true);
    setPhotoError(null);
    setSubmitError(null);

    const materialsPayload = materials
      .filter((m) => m.qty > 0)
      .map((m) => ({
        materialId: m.id,
        qty: m.qty,
      }));

    try {
      const res = await sendComplete(
        {
          orderId: order.id,
          workDone: workDone.trim(),
          faultCode,
          materials: materialsPayload,
          comment: comment.trim() || undefined,
          clientActionId,
        },
        afterPhotos,
        employee.id,
      );

      if (res.ok) {
        clientActionIdRef.current = null;
        if (res.queued) toast.show("offline");
        router.push("/worker");
      } else {
        setSubmitError(res.error);
        setLoading(false);
      }
    } catch {
      setSubmitError(t("orders.errors.unknown"));
      setLoading(false);
    }
  }

  // Шаги для StepForm
  const steps: Step[] = [
    {
      id: "works",
      title: t("worker.close.stepWorks"),
      valid: workDone.trim().length > 0,
      content: (
        <Field
          label={t("worker.close.workDoneLabel")}
          htmlFor="close-works"
          required
        >
          <TextArea
            id="close-works"
            placeholder={t("worker.close.workDonePlaceholder")}
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            rows={4}
          />
          <VoiceButton onText={(spoken) => setWorkDone((prev) => appendSpoken(prev, spoken))} />
        </Field>
      ),
    },
    {
      id: "code",
      title: t("worker.close.stepCode"),
      valid: faultCode !== "",
      content: (
        <Field
          label={t("worker.close.faultCodeLabel")}
          htmlFor="close-code"
          required
        >
          <Select
            id="close-code"
            placeholder={t("worker.close.faultCodePlaceholder")}
            value={faultCode}
            onChange={(e) => handleFaultCodeChange(e.target.value)}
            options={faultCodes.map((f) => ({
              value: f.code,
              label: `${f.code} · ${f.name}`,
            }))}
          />
        </Field>
      ),
    },
    {
      id: "materials",
      title: t("worker.close.stepMaterials"),
      valid: true,
      content: (
        <div className="flex flex-col gap-4">
          {materials.length === 0 && !isAddingMaterial ? (
            <EmptyState
              title={t("worker.close.materialsTitle")}
              text={t("worker.close.noTypicalMaterials")}
              action={
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsAddingMaterial(true)}
                  disabled={availableMaterials.length === 0}
                >
                  + {t("worker.close.addMaterial")}
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {materials.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
                >
                  <label
                    htmlFor={`mat-${m.id}`}
                    className="text-base font-semibold text-ink"
                  >
                    {m.name}, {m.unit}
                  </label>
                  <NumberStepper
                    id={`mat-${m.id}`}
                    label={m.name}
                    value={m.qty}
                    min={0}
                    step={m.unit === "кг" || m.unit === "л" ? 0.5 : 1}
                    onChange={(val) => handleQtyChange(m.id, val)}
                  />
                  {m.qty >= m.norm * 1.3 && (
                    <InlineNotice tone="warning">
                      {t("worker.close.overNorm").replace("{norm}", String(m.norm)).replace("{unit}", m.unit)}
                    </InlineNotice>
                  )}
                </div>
              ))}

              {!isAddingMaterial && availableMaterials.length > 0 && (
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setIsAddingMaterial(true)}
                >
                  + {t("worker.close.addMaterial")}
                </Button>
              )}
            </div>
          )}

          {isAddingMaterial && (
            <div className="flex flex-col gap-3 rounded-xl border-2 border-brand bg-surface p-4">
              <Field
                label={t("worker.close.selectMaterial")}
                htmlFor="select-add-mat"
              >
                <Select
                  id="select-add-mat"
                  placeholder={t("worker.close.selectMaterial")}
                  options={availableMaterials.map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.unit})`,
                  }))}
                  onChange={(e) => handleAddMaterial(e.target.value)}
                />
              </Field>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsAddingMaterial(false)}
              >
                {t("ui.action.cancel")}
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "photo",
      title: t("worker.close.stepPhoto"),
      valid: order.type !== "unplanned" || afterPhotos.length > 0,
      content: (
        <div className="flex flex-col gap-3">
          {order.type === "unplanned" && (
            <InlineNotice tone="warning">
              {t("orders.afterPhotoRequired")}
            </InlineNotice>
          )}

          {photoError && (
            <InlineNotice tone="danger">{photoError}</InlineNotice>
          )}

          {beforePhotoUrl && (
            <figure className="flex flex-col gap-2">
              <figcaption className="text-base font-semibold text-ink">{t("worker.close.silhouetteTitle")}</figcaption>
              {/* Силуэт: фото «до» в сером цвете и полупрозрачно, как контур для ракурса. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={beforePhotoUrl}
                alt={t("worker.beforePhotos")}
                className="aspect-video w-full rounded-xl border-2 border-dashed border-line-strong object-cover opacity-60 grayscale contrast-150"
              />
              <p className="text-base text-ink-muted">{t("worker.close.silhouetteHint")}</p>
            </figure>
          )}

          <PhotoPicker
            value={afterPhotos}
            onChange={(files) => {
              setAfterPhotos(files);
              setPhotoError(null);
            }}
            max={5}
          />
        </div>
      ),
    },
    {
      id: "comment",
      title: t("worker.close.stepComment"),
      valid: true,
      content: (
        <Field
          label={t("worker.close.commentLabel")}
          htmlFor="close-comment"
        >
          <TextArea
            id="close-comment"
            placeholder={t("worker.close.commentPlaceholder")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <VoiceButton onText={(spoken) => setComment((prev) => appendSpoken(prev, spoken))} />
        </Field>
      ),
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4">
      {/* Шапка формы */}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/worker/orders/${order.id}`} className="hidden lg:block">
          <Button
            variant="secondary"
            size="md"
            icon={<IconChevronLeft className="size-5" />}
            className="px-3"
          >
            {t("worker.back")}
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-ink">
          {t("worker.close.title").replace("{number}", String(order.number))}
        </h1>
      </div>

      {submitError && (
        <InlineNotice tone="danger">{submitError}</InlineNotice>
      )}

      {/* Пошаговая форма (StepForm) */}
      <StepForm
        steps={steps}
        submitLabel={t("ui.action.submit")}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </main>
  );
}
