import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Кэш отчётов в таблице report_snapshots (миграция 0016).
// Тяжёлые отчёты и тексты ИИ считаются раз в сутки (расписание /api/cron/reports) или по кнопке
// «Обновить сейчас», а при открытии страницы читаются готовыми.
//
// Читаем от имени пользователя (правила доступа: мастер и руководитель), пишем только служебным
// ключом на сервере. Если таблицы нет (миграция не применена) или чтение не удалось,
// страница не падает: результат считается как раньше.

export type Snapshot<T> = { data: T; computedAt: string | null };

// Текст ИИ из отчёта кладётся в отдельные поля строки, чтобы было видно, чем он получен.
export type AiPart = { text: unknown; source: string } | null;

type Row = { payload: Json; computed_at: string };

async function readRow(kind: string, scope: string): Promise<Row | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("report_snapshots")
      .select("payload, computed_at")
      .eq("kind", kind)
      .eq("scope", scope)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// Сколько минут назад посчитан снимок; null, если снимка нет.
export async function snapshotAgeMin(kind: string, scope: string): Promise<number | null> {
  const row = await readRow(kind, scope);
  return row ? (Date.now() - new Date(row.computed_at).getTime()) / 60000 : null;
}

// Одновременные открытия страницы не считают один и тот же отчёт несколько раз.
const inflight = new Map<string, Promise<unknown>>();

// Считает отчёт заново и записывает снимок. Если запись не удалась, результат всё равно возвращается.
export function storeSnapshot<T>(
  kind: string,
  scope: string,
  compute: () => Promise<T>,
  ai?: (value: T) => AiPart,
): Promise<Snapshot<T>> {
  const key = `${kind}:${scope}`;
  const running = inflight.get(key) as Promise<Snapshot<T>> | undefined;
  if (running) return running;

  const job = (async () => {
    const data = await compute();
    const computedAt = new Date().toISOString();
    const part = ai?.(data) ?? null;
    const { error } = await createAdminClient()
      .from("report_snapshots")
      .upsert(
        {
          kind,
          scope,
          payload: data as unknown as Json,
          ai_text: (part?.text ?? null) as Json | null,
          ai_source: part?.source ?? null,
          computed_at: computedAt,
        },
        { onConflict: "kind,scope" },
      );
    if (error) console.warn("report snapshot not saved", kind, scope, error.message);
    return { data, computedAt: error ? null : computedAt };
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

// Основная функция страниц. Свежий снимок отдаём сразу. Устаревший тоже отдаём сразу,
// а пересчёт запускаем после ответа (after), чтобы пользователь не ждал модель.
// Снимка нет — считаем при открытии, как раньше.
export async function getSnapshot<T>(
  kind: string,
  scope: string,
  compute: () => Promise<T>,
  maxAgeHours = 24,
  ai?: (value: T) => AiPart,
): Promise<Snapshot<T>> {
  const row = await readRow(kind, scope);
  if (row) {
    const age = Date.now() - new Date(row.computed_at).getTime();
    if (age >= maxAgeHours * 3600_000) {
      try {
        after(() =>
          storeSnapshot(kind, scope, compute, ai).then(
            () => undefined,
            (e) => console.warn("snapshot refresh failed", kind, scope, e),
          ),
        );
      } catch {
        // вне запроса after недоступен: остаётся прежний снимок
      }
    }
    return { data: row.payload as unknown as T, computedAt: row.computed_at };
  }
  return storeSnapshot(kind, scope, compute, ai);
}

// После «Сбросить демо» цифры изменились: снимки удаляем, чтобы они пересчитались.
export async function clearSnapshots(): Promise<void> {
  const { error } = await createAdminClient().from("report_snapshots").delete().neq("kind", "");
  if (error) console.warn("report snapshots not cleared", error.message);
}
