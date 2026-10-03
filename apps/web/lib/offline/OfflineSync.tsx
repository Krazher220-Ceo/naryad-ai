"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InlineNotice } from "@/components/ui";
import { t } from "@/lib/i18n";
import { flushQueue, pendingActions, QUEUE_EVENT } from "./queue";

// Полоса «нет сети» и отправка очереди при появлении сети. Кладётся один раз в layout исполнителя.
export function OfflineSync() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    const update = () => {
      setPending(pendingActions().length);
      setOnline(navigator.onLine);
    };
    const sync = async () => {
      update();
      if (!navigator.onLine || pendingActions().length === 0) return;
      const result = await flushQueue();
      if (result.failed.length) setFailed(result.failed);
      if (result.sent || result.failed.length) router.refresh();
      update();
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", update);
    window.addEventListener(QUEUE_EVENT, update);
    // На случай, когда браузер не прислал событие online: пробуем раз в 20 секунд.
    const timer = setInterval(sync, 20_000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", update);
      window.removeEventListener(QUEUE_EVENT, update);
      clearInterval(timer);
    };
  }, [router]);

  if (online && pending === 0 && failed.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pt-3">
      {!online && <InlineNotice tone="offline">{t("offline.noNetwork")}</InlineNotice>}
      {pending > 0 && <InlineNotice tone="warning">{t("offline.pending").replace("{n}", String(pending))}</InlineNotice>}
      {failed.map((error, i) => (
        <InlineNotice key={i} tone="danger">
          {t("offline.failed").replace("{error}", error)}
        </InlineNotice>
      ))}
    </div>
  );
}
