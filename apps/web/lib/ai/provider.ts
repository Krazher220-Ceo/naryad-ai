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
// - у каждого вызова есть таймаут: недоступная модель не останавливает цикл наряда.

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

export type ChatJsonResult<T> = { ok: true; data: T } | { ok: false; error: string };

// validate возвращает готовое значение нужного типа или null, если ответ не по схеме.
export async function chatJson<T>(params: {
  provider: AiProvider;
  system: string;
  user: string | ContentPart[];
  validate: (value: unknown) => T | null;
  withImages?: boolean;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<ChatJsonResult<T>> {
  const config = PROVIDERS[params.provider]();
  if (params.provider === "cloud" && !config.apiKey) return { ok: false, error: "DEEPSEEK_API_KEY не задан" };

  const body = {
    model: params.withImages ? config.visionModel : config.textModel,
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
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = params.validate(JSON.parse(text));
      if (parsed) return { ok: true, data: parsed };
      lastError = "ответ не по схеме";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "ошибка запроса";
    }
  }
  return { ok: false, error: lastError };
}
