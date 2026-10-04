"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, Card, cx, useToast } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { saveNotificationPrefs, setBigText, unlinkTelegram } from "@/lib/notify/actions";
import { useConnection } from "@/lib/offline/ConnectionProvider";
import type { Enums } from "@/lib/supabase/database.types";

type Kind = Enums<"notification_kind">;

// Telegram: подключить, привязать другой или отключить.
export function TelegramSection({ linked, connectUrl }: { linked: boolean; connectUrl: string | null }) {
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const unlink = (thenToast: boolean) =>
    startTransition(async () => {
      const res = await unlinkTelegram();
      if (!res.ok) toast.show("error", { detail: res.error });
      else if (thenToast) toast.show("saved", { detail: t("profile.telegram.unlinked") });
    });

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-ink">{t("profile.telegram.title")}</h2>
      <p className="flex items-center gap-2 text-base text-ink">
        <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", linked ? "bg-success" : "bg-line-strong")} />
        {linked ? t("profile.telegram.linked") : t("profile.telegram.notLinked")}
      </p>
      {linked ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {/* Привязать другой = отвязать и сразу получить новую ссылку подключения. */}
          <Button variant="secondary" size="md" loading={pending} onClick={() => unlink(false)}>
            {t("profile.telegram.relink")}
          </Button>
          <Button variant="ghost" size="md" className="text-danger" disabled={pending} onClick={() => unlink(true)}>
            {t("profile.telegram.unlink")}
          </Button>
        </div>
      ) : (
        connectUrl && (
          <a
            href={connectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-hover"
          >
            {t("profile.telegram.connect")}
          </a>
        )
      )}
    </Card>
  );
}

// Что отправлять в Telegram и тихие часы. В приложении видно всё всегда.
export function NotificationPrefsForm({
  kinds,
  initialOff,
  initialFrom,
  initialTo,
}: {
  kinds: Kind[];
  initialOff: Kind[];
  initialFrom: string | null;
  initialTo: string | null;
}) {
  const t = useT();
  const toast = useToast();
  const [off, setOff] = useState<Kind[]>(initialOff);
  const [quiet, setQuiet] = useState(Boolean(initialFrom && initialTo));
  const [from, setFrom] = useState(initialFrom ?? "22:00");
  const [to, setTo] = useState(initialTo ?? "07:00");
  const [pending, startTransition] = useTransition();

  const toggle = (kind: Kind) => setOff((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  const save = () =>
    startTransition(async () => {
      const res = await saveNotificationPrefs({
        telegramOffKinds: off,
        quietFrom: quiet ? from : null,
        quietTo: quiet ? to : null,
      });
      if (res.ok) toast.show("saved");
      else toast.show("error", { detail: res.error, onRetry: save });
    });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-ink">{t("profile.notify.title")}</h2>
        <p className="text-base text-ink-muted">{t("profile.notify.hint")}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-semibold text-ink">{t("profile.notify.telegramFor")}</legend>
        {kinds.map((kind) => {
          const id = `pref-${kind}`;
          return (
            <label
              key={kind}
              htmlFor={id}
              className="flex min-h-touch-sm cursor-pointer items-center gap-3 rounded-xl border border-line px-3 hover:bg-canvas"
            >
              <input
                id={id}
                type="checkbox"
                checked={!off.includes(kind)}
                onChange={() => toggle(kind)}
                className="size-6 accent-brand"
              />
              <span className="text-base text-ink">{t(`inbox.kind.${kind}` as MessageKey)}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="quiet-on" className="flex min-h-touch-sm cursor-pointer items-center gap-3">
          <input id="quiet-on" type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} className="size-6 accent-brand" />
          <span className="text-base font-semibold text-ink">{t("profile.notify.quiet")}</span>
        </label>
        <p className="text-sm text-ink-muted">{t("profile.notify.quietHint")}</p>
        {quiet && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-base font-semibold text-ink">
              {t("profile.notify.quietFrom")}
              <input
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="min-h-touch-sm rounded-xl border-2 border-line-strong bg-surface px-3 text-lg"
              />
            </label>
            <label className="flex flex-col gap-1 text-base font-semibold text-ink">
              {t("profile.notify.quietTo")}
              <input
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="min-h-touch-sm rounded-xl border-2 border-line-strong bg-surface px-3 text-lg"
              />
            </label>
          </div>
        )}
      </div>

      <Button fullWidth loading={pending} onClick={save}>
        {t("profile.notify.save")}
      </Button>
    </Card>
  );
}

// «Крупный текст» — две большие кнопки, как переключатель языка.
export function BigTextSwitch({ on }: { on: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const options = [
    { value: false, label: t("profile.display.bigTextOff") },
    { value: true, label: t("profile.display.bigTextOn") },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-semibold text-ink">{t("profile.display.bigText")}</span>
      <div role="group" aria-label={t("profile.display.bigText")} className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            disabled={pending}
            aria-pressed={on === o.value}
            onClick={() => startTransition(() => setBigText(o.value))}
            className={cx(
              "min-h-touch-sm rounded-lg px-2 text-base font-bold",
              on === o.value ? "bg-accent text-ink" : "text-ink hover:bg-surface",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Что лежит в телефоне: очередь неотправленных действий и кэш экранов.
export function DeviceData() {
  const t = useT();
  const toast = useToast();
  const connection = useConnection();

  const clearCache = async () => {
    // Кэш service worker хранит только оболочку и экраны. Очередь действий лежит отдельно и не трогается.
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    toast.show("saved", { detail: t("profile.device.cacheCleared") });
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-ink">{t("profile.device.title")}</h2>
      <p className="text-base text-ink">
        {connection.pending.length
          ? t("profile.device.pending").replace("{n}", String(connection.pending.length))
          : t("profile.device.none")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {connection.pending.length > 0 && (
          <Button size="md" disabled={connection.status === "offline"} onClick={connection.retry}>
            {t("profile.device.send")}
          </Button>
        )}
        <Button variant="secondary" size="md" onClick={clearCache}>
          {t("profile.device.clearCache")}
        </Button>
      </div>
    </Card>
  );
}
