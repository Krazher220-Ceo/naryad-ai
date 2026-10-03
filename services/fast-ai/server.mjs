// Быстрый слой ИИ «НарядAI»: Laya по описанию проблемы определяет категорию шифра,
// приоритет и нужную специальность и возвращает вероятности.
// Отдельный сервис, потому что модели нужно ~2 ГБ памяти — на Vercel она не поместится.
//
// Запуск:  FAST_AI_SECRET=... PORT=8787 npm start
// Запрос:  POST /classify  {"description": "..."}  с заголовком Authorization: Bearer <FAST_AI_SECRET>
// Ответ:   {"category": {"choice": "Г", "probabilities": {...}}, "priority": {...}, "specialty": {...}, "ms": 140}
// Проверка: GET /health
//
// Приложение ждёт ответ не дольше 1,5 секунды, а потом переходит на языковую модель
// (lib/ai/fast.ts). Поэтому падение этого сервиса не останавливает выдачу наряда.

import { createServer } from "node:http";
import { Laya } from "@receptron/laya";
import { QUESTIONS } from "./questions.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.FAST_AI_SECRET;
const MAX_BODY = 10_000; // описание наряда — короткий текст

console.log("Загрузка Laya…");
const laya = await Laya.load();
// Прогрев: первый вызов медленный, пусть он случится до первого настоящего запроса.
await laya.systemOne({ description: "прогрев" }, QUESTIONS);
console.log("Laya готова");

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/classify") return send(res, 404, { error: "not found" });
  if (!SECRET || req.headers.authorization !== `Bearer ${SECRET}`) return send(res, 401, { error: "unauthorized" });

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) return send(res, 413, { error: "too large" });
  }

  let description;
  try {
    description = JSON.parse(raw).description;
  } catch {
    return send(res, 400, { error: "bad json" });
  }
  if (typeof description !== "string" || !description.trim()) return send(res, 400, { error: "description required" });

  const started = performance.now();
  try {
    const result = await laya.systemOne({ description }, QUESTIONS);
    const pick = (key) => ({ choice: result.answers[key].choice, probabilities: result.answers[key].probabilities });
    send(res, 200, {
      category: pick("category"),
      priority: pick("priority"),
      specialty: pick("specialty"),
      ms: Math.round(performance.now() - started),
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "laya failed" });
  }
});

server.listen(PORT, () => console.log(`fast-ai слушает порт ${PORT}`));
