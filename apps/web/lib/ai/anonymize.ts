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
      // Обратно подставляем полное ФИО. С конца: «Сотрудник-10» раньше, чем «Сотрудник-1».
      let result = text;
      for (let i = fullNames.length - 1; i >= 0; i--) {
        result = result.split(`Сотрудник-${i + 1}`).join(fullNames[i]);
      }
      return result;
    },
  };
}
