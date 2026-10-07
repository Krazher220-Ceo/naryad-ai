// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Обезличивание: персональные данные сотрудников не уходят во внешние сервисы (AGENTS.md).
// Перед отправкой ФИО заменяются на метки «Сотрудник-1», «Сотрудник-2»…
// После ответа метки подставляются обратно, чтобы человек видел привычные имена.
// Заменяем и полное ФИО, и отдельно фамилию: в комментариях часто пишут только её.

export type Anonymizer = {
  hide: (text: string) => string;
  restore: (text: string) => string;
};

export function createAnonymizer(fullNames: string[]): Anonymizer {
  const pairs: { real: string; label: string }[] = [];
  fullNames.forEach((name, i) => {
    const label = `Сотрудник-${i + 1}`;
    pairs.push({ real: name, label });
    const surname = name.split(" ")[0];
    if (surname && surname !== name) pairs.push({ real: surname, label });
  });
  // Сначала длинные строки: иначе «Ахметов» заменится раньше, чем «Ахметов Ерлан».
  pairs.sort((a, b) => b.real.length - a.real.length);

  return {
    hide: (text) => pairs.reduce((acc, p) => acc.split(p.real).join(p.label), text),
    restore: (text) => {
      // Обратно подставляем полное ФИО. Модель может просклонять метку («у сотрудника-1»),
      // поэтому ищем её в любом падеже и регистре. (?!\d): «Сотрудник-1» не задевает «Сотрудник-10».
      let result = text;
      fullNames.forEach((name, i) => {
        result = result.replace(new RegExp(`[Сс]отрудник[а-яё]*-${i + 1}(?!\\d)`, "g"), name);
      });
      return result;
    },
  };
}
