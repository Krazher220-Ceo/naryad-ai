// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import {
  BottomActionBar,
  Button,
  Card,
  Field,
  InlineNotice,
  PhotoPicker,
  TextArea,
  TextInput,
  VoiceButton,
  appendSpoken,
  cx,
  useToast,
} from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { compress } from "@/lib/orders/photos";
import { getReporterName, sendRequest, setReporterName } from "@/lib/requests/device";

type Props = {
  code: string;
  place: { title: string; subtitle: string; equipmentId: string | null };
  // Предупреждение о дубле: по машине уже есть наряд или заявка.
  warning: string | null;
  // Оператор с общим логином участка: ФИО уже известно.
  accountName: string | null;
};

const PHRASES: MessageKey[] = [
  "report.phrase1",
  "report.phrase2",
  "report.phrase3",
  "report.phrase4",
  "report.phrase5",
  "report.phrase6",
  "report.phrase7",
];

export function ReportForm({ code, place, warning, accountName }: Props) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [state, setState] = useState<"stopped" | "defect" | "">("");
  const [what, setWhat] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);

  // ФИО с прошлого раза хранится на телефоне. Читаем после загрузки: на сервере localStorage нет.
  useEffect(() => {
    const saved = getReporterName();
    if (saved) queueMicrotask(() => setName(saved));
  }, []);

  const nameOk = Boolean(accountName) || name.trim().split(/\s+/).length >= 2;
  const errors = {
    name: !nameOk ? t("report.needName") : null,
    state: !state ? t("report.needState") : null,
    what: what.trim().length < 3 ? t("report.needWhat") : null,
  };
  const valid = !errors.name && !errors.state && !errors.what;

  async function submit() {
    setTried(true);
    if (!valid) return;
    setSending(true);
    if (!accountName) setReporterName(name);
    const photo = photos[0] ? await compress(photos[0]).catch(() => null) : null;
    const res = await sendRequest(
      {
        code,
        equipmentId: place.equipmentId,
        place: place.title,
        description: what.trim(),
        machineState: state,
        reporterName: accountName ? "" : name.trim(),
      },
      photo,
    );
    setSending(false);
    if (!res.ok) {
      toast.show("error", { detail: res.error, onRetry: submit });
      return;
    }
    if ("queued" in res) {
      toast.show("offline");
      router.push("/operator/sent?queued=1");
      return;
    }
    router.push(`/operator/sent?n=${res.number}&place=${encodeURIComponent(place.title)}`);
  }

  return (
    <div className="flex flex-col gap-4 pb-36">
      <Card className="flex flex-col gap-1 border-2 border-accent">
        <span className="text-sm font-bold tracking-wide uppercase text-brand-hover">
          {t("report.machine")} · {t("report.fromQr")}
        </span>
        <b className="text-xl text-ink">{place.title}</b>
        <span className="text-base text-ink-muted">{place.subtitle}</span>
      </Card>

      {warning && <InlineNotice tone="warning">{warning}</InlineNotice>}

      <Field
        label={t("report.who")}
        htmlFor="report-name"
        required={!accountName}
        hint={accountName ? undefined : t("report.whoHint")}
        error={tried ? errors.name ?? undefined : undefined}
      >
        {accountName ? (
          <p className="text-lg font-semibold text-ink">{t("report.whoAccount").replace("{name}", accountName)}</p>
        ) : (
          <TextInput
            id="report-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("report.whoPlaceholder")}
            autoComplete="name"
            invalid={tried && Boolean(errors.name)}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold text-ink">{t("report.state")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["stopped", "defect"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={state === value}
              onClick={() => setState(value)}
              className={cx(
                "min-h-touch rounded-xl border-2 px-3 text-lg font-bold",
                state === value
                  ? value === "stopped"
                    ? "border-danger bg-danger text-white"
                    : "border-accent bg-warning-soft text-ink"
                  : "border-line-strong bg-surface text-ink",
              )}
            >
              {value === "stopped" ? t("report.stateStopped") : t("report.stateDefect")}
            </button>
          ))}
        </div>
        {tried && errors.state && <p className="text-base font-semibold text-danger">{errors.state}</p>}
      </fieldset>

      <Field label={t("report.what")} htmlFor="report-what" required error={tried ? errors.what ?? undefined : undefined}>
        <div className="flex flex-wrap gap-2 pb-2" role="group" aria-label={t("report.phrases")}>
          {PHRASES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setWhat((cur) => appendSpoken(cur, t(key)))}
              className="min-h-touch-sm rounded-full border border-line-strong bg-surface px-4 text-base font-semibold text-ink hover:bg-canvas"
            >
              {t(key)}
            </button>
          ))}
        </div>
        <TextArea
          id="report-what"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder={t("report.whatPlaceholder")}
          invalid={tried && Boolean(errors.what)}
        />
        <VoiceButton onText={(spoken) => setWhat((cur) => appendSpoken(cur, spoken))} />
      </Field>

      <Field label={t("report.photo")} htmlFor="report-photo">
        <PhotoPicker value={photos} onChange={setPhotos} max={1} />
      </Field>

      <BottomActionBar>
        <Button fullWidth loading={sending} onClick={submit}>
          {t("report.submit")}
        </Button>
      </BottomActionBar>
    </div>
  );
}
