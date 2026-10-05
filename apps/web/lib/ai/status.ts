import "server-only";

// Где сейчас работает ИИ (страница руководителя «Настройки ИИ»).
// Каждая проверка — короткий запрос с таймаутом 2 секунды: страница не ждёт выключенный Mac.

export type ServiceState = "online" | "offline" | "off";

async function ping(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(2000), cache: "no-store" });
  } catch {
    return null;
  }
}

export async function getAiStatus(): Promise<{
  fastAi: ServiceState;
  layaModel: string | null;
  ollama: ServiceState;
  ollamaModels: string[];
  cloud: ServiceState;
}> {
  const fastUrl = process.env.FAST_AI_URL?.replace(/\/$/, "");
  const ollamaUrl = process.env.OLLAMA_URL?.replace(/\/$/, "");

  const [fast, ollama] = await Promise.all([
    fastUrl ? ping(`${fastUrl}/health`) : Promise.resolve(null),
    ollamaUrl ? ping(`${ollamaUrl}/api/tags`) : Promise.resolve(null),
  ]);

  const fastBody = fast?.ok ? ((await fast.json().catch(() => ({}))) as { model?: string }) : null;
  const ollamaBody = ollama?.ok ? ((await ollama.json().catch(() => ({}))) as { models?: { name?: string }[] }) : null;

  return {
    fastAi: !fastUrl ? "off" : fastBody ? "online" : "offline",
    layaModel: fastBody?.model ?? null,
    ollama: !ollamaUrl ? "off" : ollamaBody ? "online" : "offline",
    ollamaModels: (ollamaBody?.models ?? []).map((m) => m.name ?? "").filter(Boolean),
    // Облако не опрашиваем (платные запросы): достаточно, что ключ задан.
    cloud: process.env.DEEPSEEK_API_KEY ? "online" : "off",
  };
}
