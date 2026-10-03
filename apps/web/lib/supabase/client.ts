import { createBrowserClient } from "@supabase/ssr";

// Клиент Supabase для браузера: Realtime и чтение данных от имени пользователя.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
