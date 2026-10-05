"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/components/LocaleProvider";
import { ErrorState } from "@/components/ui";

// Экран «Не работает» для error.tsx: что случилось, код для команды и «Повторить».
// retry заново запрашивает данные страницы у сервера.
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-2 p-4 lg:py-8">
      <ErrorState
        title={t("ui.error.brokenTitle")}
        text={online ? t("ui.error.text") : t("ui.error.offlineText")}
        onRetry={retry}
      />
      {error.digest && (
        <p className="text-center text-sm text-ink-muted">{t("ui.error.code").replace("{code}", error.digest)}</p>
      )}
    </main>
  );
}
