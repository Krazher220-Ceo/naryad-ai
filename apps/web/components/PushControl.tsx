// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, Card, cx, useToast } from "@/components/ui";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/notify/push-actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "loading" | "unsupported" | "ios" | "noKey" | "denied" | "off" | "on";

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Регистрация service worker есть только в production-сборке, поэтому при разработке регистрируем сами.
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

// Состояние push на этом устройстве и действия «включить» / «выключить» / «проверить».
export function usePush() {
  const t = useT();
  const toast = useToast();
  const [state, setState] = useState<PushState>("loading");
  const [pending, startTransition] = useTransition();

  const detect = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      setState(ios ? "ios" : "unsupported");
      return;
    }
    if (!PUBLIC_KEY) return setState("noKey");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const sub = await (await getRegistration()).pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    // Определяем возможности браузера только после загрузки страницы, чтобы разметка сервера и клиента совпала.
    void Promise.resolve().then(detect);
  }, [detect]);

  const fail = (detail: string) => toast.show("error", { detail });

  const enable = () =>
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
        const reg = await getRegistration();
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
        const json = sub.toJSON();
        const res = await savePushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });
        if (!res.ok) {
          await sub.unsubscribe().catch(() => false);
          return fail(res.error);
        }
        setState("on");
        toast.show("saved", { detail: t("profile.push.turnedOn") });
      } catch {
        fail(t("profile.push.failed"));
      }
    });

  const disable = () =>
    startTransition(async () => {
      try {
        const sub = await (await getRegistration()).pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
        toast.show("saved", { detail: t("profile.push.turnedOff") });
      } catch {
        fail(t("orders.errors.unknown"));
      }
    });

  const test = () =>
    startTransition(async () => {
      const res = await sendTestPush();
      if (res.ok) toast.show("saved", { detail: t("profile.push.testSent") });
      else fail(res.error);
    });

  return { state, pending, enable, disable, test };
}

// Блок в профиле: «Уведомления на этом устройстве».
export function PushSection() {
  const t = useT();
  const { state, pending, enable, disable, test } = usePush();

  const hint =
    state === "ios" ? t("profile.push.iosHint") : state === "unsupported" ? t("profile.push.unsupported") : state === "denied" ? t("profile.push.denied") : state === "noKey" ? t("profile.push.notConfigured") : null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-ink">{t("profile.push.title")}</h2>
        <p className="text-base text-ink-muted">{t("profile.push.hint")}</p>
      </div>
      {state !== "loading" && (
        <p className="flex items-center gap-2 text-base text-ink">
          <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", state === "on" ? "bg-success" : "bg-line-strong")} />
          {state === "on" ? t("profile.push.enabled") : t("profile.push.notEnabled")}
        </p>
      )}
      {hint && <p className="rounded-xl bg-canvas px-3 py-2 text-base text-ink">{hint}</p>}
      {state === "off" && (
        <Button loading={pending} onClick={enable}>
          {t("profile.push.enable")}
        </Button>
      )}
      {state === "on" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" loading={pending} onClick={test}>
            {t("profile.push.test")}
          </Button>
          <Button variant="ghost" className="text-danger" disabled={pending} onClick={disable}>
            {t("profile.push.disable")}
          </Button>
        </div>
      )}
    </Card>
  );
}

const DISMISS_KEY = "push-banner-dismissed";

// Плашка на доске мастера: предложить включить уведомления. Показывается, пока они выключены и плашку не закрыли.
export function PushBanner() {
  const t = useT();
  const { state, pending, enable } = usePush();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Читаем сохранённый выбор после загрузки: на сервере localStorage нет.
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // без хранилища плашка показывается
    }
    void Promise.resolve().then(() => setHidden(dismissed));
  }, []);

  if (hidden || state !== "off") return null;

  const later = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // без хранилища плашка просто скроется до перезагрузки
    }
    setHidden(true);
  };

  return (
    <aside aria-label={t("profile.push.title")} className="mx-auto w-full max-w-xl px-4 pt-4 lg:max-w-6xl">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base font-semibold text-ink">{t("profile.push.bannerText")}</p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button loading={pending} onClick={enable}>
            {t("profile.push.enable")}
          </Button>
          <Button variant="ghost" onClick={later}>
            {t("profile.push.bannerLater")}
          </Button>
        </div>
      </Card>
    </aside>
  );
}
