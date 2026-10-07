// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { redirect } from "next/navigation";

// Корень: proxy.ts уже отправил вошедшего пользователя на экран его роли.
// Сюда попадает только тот, кто не вошёл.
export default function Home() {
  redirect("/demo");
}
