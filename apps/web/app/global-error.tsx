"use client";

import ru from "@/messages/ru.json";
import kk from "@/messages/kk.json";
import "./globals.css";

// Сломался сам корневой каркас: словаря в контексте нет, поэтому показываем оба языка.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-4 text-center text-ink">
        <p className="text-2xl font-bold">{ru.ui.error.brokenTitle}</p>
        <p className="max-w-sm text-base">{ru.ui.error.text}</p>
        <p className="max-w-sm text-base text-ink-muted">{kk.ui.error.text}</p>
        {error.digest && <p className="text-sm text-ink-muted">{ru.ui.error.code.replace("{code}", error.digest)}</p>}
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-touch rounded-xl bg-brand px-6 text-lg font-semibold text-white"
        >
          {ru.ui.action.retry}
        </button>
      </body>
    </html>
  );
}
