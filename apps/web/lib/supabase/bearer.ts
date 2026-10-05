import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Клиент для Android-приложения: токен входа приходит в заголовке Authorization, а не в cookie.
// Запросы идут от имени этого пользователя, поэтому правила доступа базы работают как на сайте.
export function createBearerClient(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
