// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  IconCheck,
  InlineNotice,
  PhotoPicker,
  PRIORITIES,
  SegmentedControl,
  Select,
  Skeleton,
  StepForm,
  TextArea,
  TextInput,
  VoiceButton,
  Dictaphone,
  type DictatedFields,
  WORK_TYPES,
  appendSpoken,
  WorkerChip,
  cx,
} from "@/components/ui";
import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { createOrder, suggestForIssue } from "@/lib/orders/actions";
import { uploadOrderPhoto } from "@/lib/orders/photos";
import type { IssueFormData } from "@/lib/orders/queries";
import type { OrderPriority, OrderType } from "@/lib/orders/types";
import {
  IssueSuggestion,
  type IssueCandidate,
  type IssueClassification,
} from "./IssueSuggestion";
import { EquipmentPicker } from "./EquipmentPicker";
import { LayaExpress, type ExpressFilled, type ExpressResult } from "./LayaExpress";

const DESCRIPTION_CHIPS = [
  "master.issue.chips.leak",
  "master.issue.chips.noStart",
  "master.issue.chips.noise",
  "master.issue.chips.vibration",
  "master.issue.chips.overheat",
  "master.issue.chips.belt",
] as const satisfies readonly MessageKey[];

type Worker = IssueFormData["workers"][number];

// Кого предложить: свободного, иначе того, у кого меньше очередь. Не на смене — в последнюю очередь.
function suggestWorker(workers: Worker[]): Worker | undefined {
  const onShift = workers.filter((w) => w.board_status !== "off");
  const pool = onShift.length > 0 ? onShift : workers;
  // Нагрузка: наряды в очереди плюс выданные, но ещё не принятые.
  const load = (w: Worker) => (w.queue_count ?? 0) + (w.pending_count ?? 0);
  const free = pool.filter((w) => w.board_status === "free").sort((a, b) => load(a) - load(b));
  if (free.length > 0) return free[0];
  return [...pool].sort((a, b) => load(a) - load(b))[0];
}

// Срок в часах: аварийный 1 ч, иначе норматив шифра, иначе 4 ч.
function dueHours(priority: OrderPriority, normHours: number | undefined): number {
  if (priority === "emergency") return 1;
  return normHours ?? 4;
}

function dueAtIso(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function dueAtMinutesIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function IssueOrderForm({
  data,
  employeeId,
  initialEquipmentId = null,
  initialDescription = "",
  requestId,
}: {
  data: IssueFormData;
  employeeId: string;
  initialEquipmentId?: string | null;
  // Наряд по попутной заявке исполнителя: описание из заявки, заявка закрывается при выдаче.
  initialDescription?: string;
  requestId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [equipmentId, setEquipmentId] = useState<string | null>(initialEquipmentId);
  const [search, setSearch] = useState("");
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState<OrderPriority>("normal");
  const [type, setType] = useState<OrderType>("unplanned");
  const [faultCode, setFaultCode] = useState("");
  const [dueMode, setDueMode] = useState<"norm" | "demo2min">("norm");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [pickingWorker, setPickingWorker] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Наряд уже создан, а упала загрузка фото: тогда показываем ссылку на панель.
  const [orderCreated, setOrderCreated] = useState(false);

  // При повторе после ошибки берём тот же id, чтобы наряд не задвоился.
  const actionId = useRef<string | null>(null);
  const createdOrderId = useRef<string | null>(null);
  const uploadedCount = useRef(0);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestionUnavailable, setSuggestionUnavailable] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    classification: IssueClassification;
    candidates: IssueCandidate[];
  } | null>(null);

  const hasManuallyChangedPriority = useRef(false);
  const hasManuallyChangedFaultCode = useRef(false);
  const hasManuallyChangedAssignee = useRef(false);
  const lastFetchedDesc = useRef<string | null>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  // Переход на последний шаг после экспресс-выдачи; key меняется при каждом запуске.
  const [jumpTo, setJumpTo] = useState<{ step: number; key: number } | undefined>(undefined);

  const triggerSuggest = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed === lastFetchedDesc.current) return;
      lastFetchedDesc.current = trimmed;
      setSuggesting(true);
      setSuggestionUnavailable(false);
      try {
        const result = await suggestForIssue(trimmed);
        if (!result.ok || !result.data.classification) {
          setSuggestion(null);
          setSuggestionUnavailable(true);
          return;
        }

        const { classification, candidates } = result.data;
        setSuggestion({
          classification: classification as IssueClassification,
          candidates: candidates as IssueCandidate[],
        });
        setSuggestionUnavailable(false);

        // Подставить шифр, если мастер ещё не менял вручную и он есть в списке шифров формы
        if (!hasManuallyChangedFaultCode.current && classification.faultCode) {
          const match = data.faultCodes.some((f) => f.code === classification.faultCode);
          if (match) {
            setFaultCode(classification.faultCode);
          }
        }

        // Подставить приоритет, если мастер не выбирал его сам на шаге 2. Аварийный, выбранный мастером, никогда не понижать.
        if (!hasManuallyChangedPriority.current && classification.priority) {
          setPriority((prev) =>
            prev === "emergency" && classification.priority !== "emergency" ? prev : classification.priority!,
          );
        }

        // Подставить исполнителя = candidates[0], если мастер ещё не выбирал вручную
        if (!hasManuallyChangedAssignee.current && candidates && candidates.length > 0) {
          const topCandidate = data.workers.find((w) => w.id === candidates[0].id);
          if (topCandidate) {
            setAssigneeId(topCandidate.id);
          }
        }
      } catch {
        setSuggestion(null);
        setSuggestionUnavailable(true);
      } finally {
        setSuggesting(false);
      }
    },
    [data.faultCodes, data.workers],
  );

  useEffect(() => {
    const trimmed = description.trim();
    if (trimmed.length < 10) return;
    const timer = setTimeout(() => {
      triggerSuggest(trimmed);
    }, 1200);
    return () => clearTimeout(timer);
  }, [description, triggerSuggest]);

  useEffect(() => {
    const el = step3Ref.current;
    if (!el) return;
    const section = el.closest("section");
    if (!section) return;

    function checkVisibility() {
      if (!section) return;
      const isHidden = section.classList.contains("hidden");
      const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
      const trimmed = description.trim();
      if ((!isHidden || isDesktop) && trimmed.length > 0) {
        triggerSuggest(trimmed);
      }
    }

    checkVisibility();

    const mo = new MutationObserver(() => {
      checkVisibility();
    });
    mo.observe(section, { attributes: true, attributeFilter: ["class"] });

    return () => mo.disconnect();
  }, [description, triggerSuggest]);

  const equipment = data.equipment.find((e) => e.id === equipmentId);
  const suggested = suggestWorker(data.workers);
  const assignee = data.workers.find((w) => w.id === assigneeId) ?? suggested;
  const noneFree = !data.workers.some((w) => w.board_status === "free");
  const norm = data.faultCodes.find((f) => f.code === faultCode)?.norm_hours;
  const hours = dueHours(priority, norm);

  const query = search.trim().toLowerCase();
  const filtered = data.equipment.filter(
    (e) => !query || e.name.toLowerCase().includes(query) || e.inventory_no.toLowerCase().includes(query),
  );

  async function submit() {
    if (!equipment) return;
    setLoading(true);
    setError(null);
    try {
      if (!createdOrderId.current) {
        actionId.current ??= crypto.randomUUID();
        const result = await createOrder({
          type,
          description: description.trim(),
          sectionId: equipment.section_id,
          equipmentId: equipment.id,
          priority,
          dueAt: dueMode === "demo2min" ? dueAtMinutesIso(2) : dueAtIso(hours),
          assigneeId: assignee?.id ?? undefined,
          faultCode: faultCode || undefined,
          requestId,
          clientActionId: actionId.current,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        createdOrderId.current = result.data.orderId;
        setOrderCreated(true);
      }
      // Фото грузим по одному; при сбое повтор продолжит с того же места.
      while (uploadedCount.current < photos.length) {
        await uploadOrderPhoto({
          orderId: createdOrderId.current,
          kind: "before",
          file: photos[uploadedCount.current],
          authorId: employeeId,
        });
        uploadedCount.current += 1;
      }
      router.push("/master");
    } catch {
      setError(createdOrderId.current ? t("orders.errors.photoUpload") : t("orders.errors.unknown"));
    } finally {
      setLoading(false);
    }
  }

  // Защита от дублей: открытые наряды по выбранному оборудованию.
  const duplicates = data.openOrders.filter((o) => o.equipment_id === equipmentId);
  const openCountByEquipment = new Map<string, number>();
  for (const o of data.openOrders) openCountByEquipment.set(o.equipment_id, (openCountByEquipment.get(o.equipment_id) ?? 0) + 1);

  // Экспресс-выдача Laya: заполняем форму из ответа и возвращаем, какие поля заполнены.
  // Поля помечаем «выбрано вручную», чтобы подсказка по описанию их потом не перебила.
  function applyExpress(phrase: string, r: ExpressResult): ExpressFilled {
    const { fields, classification, candidates } = r;
    const equipment = fields.equipmentId && data.equipment.some((e) => e.id === fields.equipmentId) ? fields.equipmentId : null;
    const prio = fields.priority ?? classification?.priority ?? null;
    const code = [fields.faultCode, classification?.faultCode].find((c) => c && data.faultCodes.some((f) => f.code === c)) ?? null;
    const workerId = [fields.assigneeId, candidates[0]?.id].find((id) => id && data.workers.some((w) => w.id === id)) ?? null;
    const filled: ExpressFilled = { equipment: !!equipment, priority: !!prio, faultCode: !!code, assignee: !!workerId };

    // Ничего не распознали — форму не трогаем, мастер заполняет сам.
    if (!Object.values(filled).some(Boolean)) return filled;

    // Новая фраза заменяет всё: чего в ней нет, сбрасываем, чтобы не осталось значений от прошлого запуска.
    setEquipmentId(equipment);
    setSearch("");
    setPriority(prio ?? "normal");
    hasManuallyChangedPriority.current = !!prio;
    setFaultCode(code ?? "");
    hasManuallyChangedFaultCode.current = !!code;
    if (workerId) {
      hasManuallyChangedAssignee.current = true;
      setAssigneeId(workerId);
    }

    const text = (fields.problem ?? phrase).trim();
    setDescription(text);
    lastFetchedDesc.current = text;
    if (classification) {
      setSuggestion({
        classification: classification as IssueClassification,
        candidates: candidates as IssueCandidate[],
      });
      setSuggestionUnavailable(false);
    } else {
      setSuggestion(null);
      setSuggestionUnavailable(true);
    }
    // Оборудование не узнали — открываем шаг 1, иначе сразу шаг подтверждения.
    setJumpTo({ step: equipment ? steps.length - 1 : 0, key: Date.now() });
    return filled;
  }

  // Шаблон плановой работы заполняет описание, шифр и приоритет.
  function applyTemplate(template: IssueFormData["templates"][number]) {
    setDescription(template.description);
    setType(template.type);
    if (template.fault_code) {
      hasManuallyChangedFaultCode.current = true;
      setFaultCode(template.fault_code);
    }
    if (template.type === "planned") {
      hasManuallyChangedPriority.current = true;
      setPriority("planned");
    }
  }

  // Поля из речи заполняют форму, но не перебивают то, что мастер уже выбрал руками.
  function applyDictated(f: DictatedFields) {
    if (f.equipmentId && data.equipment.some((e) => e.id === f.equipmentId)) setEquipmentId(f.equipmentId);
    if (f.priority) {
      hasManuallyChangedPriority.current = true;
      setPriority(f.priority);
    }
    if (f.faultCode) {
      hasManuallyChangedFaultCode.current = true;
      setFaultCode(f.faultCode);
    }
    if (f.assigneeId && data.workers.some((w) => w.id === f.assigneeId)) {
      hasManuallyChangedAssignee.current = true;
      setAssigneeId(f.assigneeId);
    }
  }

  function describeDictated(f: DictatedFields) {
    const rows: { label: string; value: string }[] = [];
    const eq = data.equipment.find((e) => e.id === f.equipmentId);
    if (eq) rows.push({ label: t("voice.field.equipment"), value: eq.name });
    if (f.problem) rows.push({ label: t("voice.field.problem"), value: f.problem });
    if (f.priority) rows.push({ label: t("voice.field.priority"), value: t(`orders.priority.${f.priority}`) });
    if (f.faultCode) rows.push({ label: t("voice.field.faultCode"), value: f.faultCode });
    const w = data.workers.find((x) => x.id === f.assigneeId);
    if (w?.full_name) rows.push({ label: t("voice.field.assignee"), value: w.full_name });
    return rows;
  }

  const steps = [
    {
      id: "equipment",
      title: t("master.issue.steps.equipment"),
      valid: equipmentId !== null,
      content: (
        <>
          <TextInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("master.issue.search")}
            aria-label={t("master.issue.search")}
          />
          {query ? (
            <>
              {filtered.length === 0 && <p className="text-base text-ink-muted">{t("master.issue.noEquipment")}</p>}
              {data.sections.map((section) => {
              const items = filtered.filter((e) => e.section_id === section.id);
              if (items.length === 0) return null;
              return (
                <div key={section.id} className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-ink-muted">{section.name}</h3>
                  {items.map((e) => {
                    const selected = e.id === equipmentId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setEquipmentId(e.id)}
                        className={cx(
                          "flex min-h-touch items-center justify-between gap-2 rounded-xl border-2 px-4 text-left text-lg font-semibold",
                          selected ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
                        )}
                      >
                        <span>
                          {e.name} <span className="font-normal">· {e.inventory_no}</span>
                          {openCountByEquipment.has(e.id) && (
                            <span className={cx("block text-base font-normal", selected ? "text-white" : "text-ink-muted")}>
                              {t("master.issue.openOrdersBadge").replace("{n}", String(openCountByEquipment.get(e.id)))}
                            </span>
                          )}
                        </span>
                        {selected && <IconCheck className="size-6 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            </>
          ) : (
            <EquipmentPicker
              sections={data.sections}
              equipment={data.equipment}
              selectedId={equipmentId}
              openCount={openCountByEquipment}
              onSelect={setEquipmentId}
            />
          )}
        </>
      ),
    },
    {
      id: "problem",
      title: t("master.issue.steps.problem"),
      valid: description.trim().length > 0,
      content: (
        <>
          {duplicates.length > 0 && (
            <InlineNotice tone="warning">
              <div className="flex flex-col gap-2">
                <span className="font-semibold">{t("master.issue.duplicateTitle")}</span>
                {duplicates.map((o) => (
                  <Link key={o.id} href={`/master/orders/${o.id}`} className="underline">
                    {t("master.issue.duplicateItem")
                      .replace("{number}", String(o.number))
                      .replace("{status}", t(`orders.status.${o.status}`).toLowerCase())
                      .replace("{description}", o.description)}
                  </Link>
                ))}
                <span>{t("master.issue.duplicateHint")}</span>
              </div>
            </InlineNotice>
          )}
          <div className="flex flex-wrap gap-2">
            {DESCRIPTION_CHIPS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDescription(t(key))}
                className="min-h-touch-sm rounded-xl border-2 border-line-strong bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas active:bg-line lg:px-3 lg:text-sm"
              >
                {t(key)}
              </button>
            ))}
          </div>
          <Field label={t("master.issue.description")} htmlFor="issue-description" hint={t("master.issue.descriptionHint")} required>
            <TextArea id="issue-description" className="lg:h-24 lg:py-2" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <VoiceButton onText={(spoken) => setDescription((prev) => appendSpoken(prev, spoken))} />
              {/* Диктофон: Whisper на нашем Mac и разбор речи по полям. Поля человек проверяет перед выдачей. */}
              <Dictaphone
                mode="order"
                onText={(spoken) => setDescription((prev) => (prev.trim() ? appendSpoken(prev, spoken) : spoken))}
                onFields={applyDictated}
                describe={describeDictated}
              />
            </div>
          </Field>
          <Field label={t("master.issue.priority")}>
            <SegmentedControl
              ariaLabel={t("master.issue.priority")}
              className="lg:grid-cols-2 2xl:grid-cols-4"
              value={priority}
              onChange={(p) => {
                hasManuallyChangedPriority.current = true;
                setPriority(p);
              }}
              options={PRIORITIES.map((p) => ({
                value: p,
                label: t(`orders.priority.${p}`),
                tone: p === "emergency" ? "danger" : "default",
              }))}
            />
          </Field>
          <Field label={t("master.issue.type")}>
            <SegmentedControl
              ariaLabel={t("master.issue.type")}
              value={type}
              onChange={setType}
              options={WORK_TYPES.map((w) => ({ value: w, label: t(`orders.type.${w}`) }))}
            />
          </Field>
          {type === "planned" && data.templates.length > 0 && (
            <Field label={t("master.issue.templates")}>
              <div className="flex flex-col gap-2">
                {data.templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="min-h-touch rounded-xl border-2 border-line-strong bg-surface px-4 text-left text-base font-semibold text-ink hover:bg-canvas active:bg-line"
                  >
                    {tpl.name}
                    {tpl.fault_code && <span className="font-normal text-ink-muted"> · {tpl.fault_code}</span>}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </>
      ),
    },
    {
      id: "assignee",
      title: t("master.issue.steps.assignee"),
      content: (
        <>
          <div ref={step3Ref} />
          {suggesting && (
            <InlineNotice tone="info">
              <div className="flex flex-col gap-2">
                <span>{t("issueAi.loading")}</span>
                <Skeleton className="h-3 w-48" />
              </div>
            </InlineNotice>
          )}
          {!suggesting && suggestionUnavailable && (
            <InlineNotice tone="info">{t("issueAi.unavailable")}</InlineNotice>
          )}
          {!suggesting && suggestion && (
            <IssueSuggestion
              classification={suggestion.classification}
              candidates={suggestion.candidates}
              selectedWorkerId={assignee?.id}
              onSelectCandidate={(id) => {
                hasManuallyChangedAssignee.current = true;
                setAssigneeId(id);
              }}
            />
          )}
          <Field label={t("master.issue.assignee")}>
            {data.workers.length === 0 ? (
              <InlineNotice tone="warning">{t("master.issue.noWorkers")}</InlineNotice>
            ) : (
              <div className="flex flex-col gap-3">
                {noneFree && assignee && (
                  <InlineNotice tone="warning">
                    {t("master.issue.allBusy").replace("{name}", assignee.full_name ?? "")}
                  </InlineNotice>
                )}
                {assignee && (
                  <WorkerChip
                    name={assignee.full_name ?? ""}
                    state={assignee.board_status}
                    orderNumber={assignee.current_order_number ?? undefined}
                    queueCount={assignee.queue_count ?? undefined}
                  />
                )}
                <Button variant="secondary" size="md" onClick={() => setPickingWorker(!pickingWorker)}>
                  {t("master.issue.change")}
                </Button>
                {pickingWorker && (
                  <ul className="flex flex-col gap-2">
                    {data.workers.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          aria-pressed={w.id === assignee?.id}
                          onClick={() => {
                            hasManuallyChangedAssignee.current = true;
                            setAssigneeId(w.id);
                            setPickingWorker(false);
                          }}
                          className={cx("block w-full rounded-xl text-left", w.id === assignee?.id && "ring-4 ring-brand")}
                        >
                          <WorkerChip
                            name={w.full_name ?? ""}
                            state={w.board_status}
                            orderNumber={w.current_order_number ?? undefined}
                            queueCount={w.queue_count ?? undefined}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>
          <Field label={t("master.issue.faultCode")} htmlFor="issue-fault" hint={t("master.issue.faultCodeHint")}>
            <Select
              id="issue-fault"
              value={faultCode}
              onChange={(e) => {
                hasManuallyChangedFaultCode.current = true;
                setFaultCode(e.target.value);
              }}
              options={data.faultCodes.map((f) => ({ value: f.code, label: `${f.code} · ${f.name}` }))}
            />
          </Field>
          <Field label={t("demo.dueModeLabel")}>
            <SegmentedControl
              ariaLabel={t("demo.dueModeLabel")}
              value={dueMode}
              onChange={setDueMode}
              options={[
                { value: "norm", label: t("demo.dueNorm") },
                { value: "demo2min", label: t("demo.due2min") },
              ]}
            />
          </Field>
          <p className="text-lg font-semibold text-ink">
            {dueMode === "demo2min"
              ? t("demo.dueIn2Min")
              : t("master.issue.dueIn").replace("{hours}", String(hours))}
          </p>
          <Field label={t("master.issue.photos")} hint={t("master.issue.photosHint")}>
            <PhotoPicker value={photos} onChange={setPhotos} max={5} />
          </Field>
          {error && (
            <InlineNotice
              tone="danger"
              action={
                orderCreated ? (
                  <Link href="/master" className="text-base font-bold underline">
                    {t("master.card.back")}
                  </Link>
                ) : undefined
              }
            >
              {error}
            </InlineNotice>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {equipment && (
        <p className="mb-4 text-base lg:mb-2 lg:text-sm text-ink-muted">
          {t("master.issue.section")}: {data.sections.find((s) => s.id === equipment.section_id)?.name}
        </p>
      )}
      <div className="mb-4 lg:mb-3">
        <LayaExpress onResult={applyExpress} />
      </div>
      <StepForm wide steps={steps} submitLabel={t("master.issue.submit")} onSubmit={submit} loading={loading} jumpTo={jumpTo} />
    </div>
  );
}
