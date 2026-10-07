// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { signOut } from "@/lib/auth/actions";

// Выход из аккаунта. Перед выходом просим service worker стереть сохранённые экраны:
// следующий человек на этом телефоне не увидит чужие наряды без сети.
export function SignOutButton({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        navigator.serviceWorker?.controller?.postMessage("clear-pages");
      }}
    >
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
