// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Правила пароля (AGENTS.md): не короче 8 символов, есть буквы и цифры.
// Одна функция для проверки вживую на экране и на сервере.

export type PasswordProblem = "length" | "letter" | "digit" | "same";

export function passwordProblems(password: string, current?: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < 8) problems.push("length");
  if (!/\p{L}/u.test(password)) problems.push("letter");
  if (!/\d/.test(password)) problems.push("digit");
  if (current !== undefined && password === current) problems.push("same");
  return problems;
}
