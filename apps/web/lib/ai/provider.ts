// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import "server-only";

// Единственное место, откуда приложение обращается к языковым моделям (правило AGENTS.md).
//
// Два режима, переключаются настройкой settings.ai_provider (или AI_PROVIDER в .env):
//   cloud — DeepSeek (модель deepseek-flash понимает и текст, и фото);
//   local — Ollama на своём компьютере, данные не уходят наружу.
// У обоих одинаковый API в стиле OpenAI (/chat/completions), поэтому клиент один, на обычном fetch.
//
// Правила:
// - ответ всегда строгий JSON, который проверяется функцией validate;
// - при ошибке разбора или проверки — ещё одна попытка, затем ошибка (вызывающий ставит needs_master);
// - у каждого вызова есть таймаут: недоступная модель не останавливает цикл наряда;
// - cloudFallback: если Mac (local) не ответил, тот же запрос уходит в облако.
//   Включать только там, где данные уже обезличены (имена заменены метками).

export type AiProvider = "cloud" | "local";

type ProviderConfig = { url: string; apiKey?: string; textModel: string; visionModel: string };

const PROVIDERS: Record<AiProvider, () => ProviderConfig> = {
  cloud: () => ({
    url: "https://api.deepseek.com/chat/completions",
    apiKey: process.env.DEEPSEEK_API_KEY,
    textModel: "deepseek-flash",
    visionModel: "deepseek-flash",
  }),
  local: () => ({
    url: `${process.env.OLLAMA_URL ?? "http://localhost:11434"}/v1/chat/completions`,
    textModel: process.env.OLLAMA_TEXT_MODEL ?? "qwen2.5vl:7b",
    visionModel: process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:7b",
  }),
};

// Часть сообщения: текст или картинка в виде data:image/jpeg;base64,...
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type ChatJsonResult<T> = { ok: true; data: T; provider: AiProvider } | { ok: false; error: string };

// validate возвращает готовое значение нужного типа или null, если ответ не по схеме.
type ChatParams<T> = {
  provider: AiProvider;
  system: string;
  user: string | ContentPart[];
  validate: (value: unknown) => T | null;
  withImages?: boolean;
  timeoutMs?: number;
  maxTokens?: number;
  // Своя модель для задачи, например Qwen3-4B для разбора речи (OLLAMA_VOICE_MODEL).
  model?: string;
  cloudFallback?: boolean;
};

export async function chatJson<T>(params: ChatParams<T>): Promise<ChatJsonResult<T>> {
  const first = await callProvider(params.provider, params);
  if (first.ok || params.provider !== "local" || !params.cloudFallback) return first;
  // Порядок по AGENTS.md: Mac → облако → правила. Своя модель Mac облаку не подходит.
  const cloud = await callProvider("cloud", { ...params, model: undefined });
  return cloud.ok ? cloud : { ok: false, error: `Mac: ${first.error}; облако: ${cloud.error}` };
}

async function callProvider<T>(provider: AiProvider, params: ChatParams<T>): Promise<ChatJsonResult<T>> {
  const config = PROVIDERS[provider]();
  if (provider === "cloud" && !config.apiKey) return { ok: false, error: "DEEPSEEK_API_KEY не задан" };

  const body = {
    model: params.model ?? (params.withImages ? config.visionModel : config.textModel),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    // С запасом: модель тратит часть токенов на рассуждение до ответа.
    max_tokens: params.maxTokens ?? 1500,
  };

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(params.timeoutMs ?? 30000),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        // Mac недоступен — второй раз ждать не стоит, сразу к облаку.
        if (provider === "local") break;
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = params.validate(JSON.parse(text));
      if (parsed) return { ok: true, data: parsed, provider };
      lastError = "ответ не по схеме";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "ошибка запроса";
      // Таймаут или обрыв связи с Mac: повтор только удвоит ожидание.
      if (provider === "local" && !(e instanceof SyntaxError)) break;
    }
  }
  return { ok: false, error: lastError };
}
