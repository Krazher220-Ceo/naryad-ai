"use client";

import { ErrorState } from "@/components/ui";

// Ошибка загрузки любой страницы мастера: показываем её и даём «Повторить».
export default function MasterError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col p-4">
      <ErrorState onRetry={reset} />
    </main>
  );
}
