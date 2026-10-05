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
