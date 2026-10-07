// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Как запускать: node scripts/telegram/set-webhook.mjs [адрес]
// Пример: node scripts/telegram/set-webhook.mjs https://naryad-ai.vercel.app

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к apps/web/.env.local относительно расположения скрипта
const envPath = path.resolve(__dirname, "../../apps/web/.env.local");

if (!fs.existsSync(envPath)) {
  console.error("Файл apps/web/.env.local не найден");
  process.exit(1);
}

// Построчный разбор .env.local
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  envVars[key] = val;
}

const botToken = envVars.TELEGRAM_BOT_TOKEN;
const webhookSecret = envVars.TELEGRAM_WEBHOOK_SECRET;

if (!botToken) {
  console.error("TELEGRAM_BOT_TOKEN не задан в apps/web/.env.local");
  process.exit(1);
}

if (!webhookSecret) {
  console.error("TELEGRAM_WEBHOOK_SECRET не задан в apps/web/.env.local");
  process.exit(1);
}

// Адрес приложения из аргумента или значение по умолчанию
const appBaseUrl = (process.argv[2] || "https://naryad-ai.vercel.app").replace(/\/+$/, "");
const webhookUrl = `${appBaseUrl}/api/telegram/webhook`;

console.log(`Установка вебхука Telegram: ${webhookUrl}`);

try {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
    }),
  });

  const data = await response.json();
  console.log("Ответ Telegram:", JSON.stringify(data, null, 2));

  if (!response.ok || !data.ok) {
    process.exit(1);
  }
} catch (error) {
  console.error("Ошибка при установке вебхука:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
