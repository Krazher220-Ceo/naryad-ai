import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Клиент базы для расчётов. Если не передан, расчёт идёт от имени вошедшего пользователя.
export type Db = SupabaseClient<Database>;
