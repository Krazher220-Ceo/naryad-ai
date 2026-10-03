import "server-only";
import { createClient } from "@supabase/supabase-js";

// Служебный клиент: обходит правила доступа. Только на сервере, только для системных задач
// (расписание, сброс демо). Никогда не импортировать в клиентские компоненты.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
