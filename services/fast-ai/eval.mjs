// Тест Laya на 20 русских описаниях (открытый вопрос из PLAN.md, раздел 11).
// Для каждого описания заранее записан правильный ответ. Скрипт считает долю совпадений
// и среднюю уверенность модели. Описания вымышленные, демонстрационные.
// Запуск: npm run eval

import { Laya } from "@receptron/laya";
import { QUESTIONS } from "./questions.mjs";

const CASES = [
  ["Течь масла из-под уплотнения вала шламового насоса, под насосом лужа", "Г", "high", "слесарь"],
  ["Не запускается электродвигатель конвейера К-3, при пуске выбивает автомат", "Э", "emergency", "электрик"],
  ["Посторонний шум и сильная вибрация подшипникового узла дробилки", "М", "high", "слесарь"],
  ["Плановая смазка подшипников приводного барабана", "С", "planned", "слесарь"],
  ["Порвана конвейерная лента, конвейер остановлен, участок стоит", "М", "emergency", "слесарь"],
  ["Искрит электрощит на участке сушки, запах гари", "Э", "emergency", "электрик"],
  ["Утечка воздуха в пневмолинии на флотомашине, слышно шипение", "П", "normal", "слесарь"],
  ["Трещина в раме питателя, нужно заварить", "М", "high", "сварщик"],
  ["Повреждён рукав высокого давления гидросистемы дробилки, течёт масло", "Г", "emergency", "слесарь"],
  ["Не срабатывает датчик уровня в зумпфе", "Э", "normal", "электрик"],
  ["Перегрев редуктора, масло тёмное и загрязнённое", "С", "high", "слесарь"],
  ["Плановый осмотр и замена футеровки мельницы по графику ППР", "М", "planned", "слесарь"],
  ["Пневмоцилиндр затвора бункера не двигается", "П", "high", "слесарь"],
  ["Ослаб крепёж кожуха муфты, кожух дребезжит", "М", "normal", "слесарь"],
  ["Обрыв кабеля питания вентилятора сушильного барабана", "Э", "high", "электрик"],
  ["Падает давление в гидросистеме пресса", "Г", "high", "слесарь"],
  ["Не работает централизованная система смазки конвейера", "С", "high", "слесарь"],
  ["Отломился кронштейн ограждения, требуется сварка", "М", "normal", "сварщик"],
  ["Засор пневмолинии продувки фильтра", "П", "normal", "слесарь"],
  ["Плановая замена масла в редукторе мельницы", "С", "planned", "слесарь"],
];

const laya = await Laya.load();
const hits = { category: 0, priority: 0, specialty: 0 };
const confidence = { category: 0, priority: 0, specialty: 0 };
let totalMs = 0;

for (const [text, category, priority, specialty] of CASES) {
  const expected = { category, priority, specialty };
  const started = performance.now();
  const result = await laya.systemOne({ description: text }, QUESTIONS);
  totalMs += performance.now() - started;

  const marks = [];
  for (const key of Object.keys(expected)) {
    const answer = result.answers[key];
    const ok = answer.choice === expected[key];
    if (ok) hits[key]++;
    confidence[key] += answer.probabilities[answer.choice];
    marks.push(`${key}=${answer.choice}${ok ? "" : `(нужно ${expected[key]})`} ${answer.probabilities[answer.choice].toFixed(2)}`);
  }
  console.log(`${text.slice(0, 50).padEnd(50)} | ${marks.join(" | ")}`);
}

const n = CASES.length;
console.log("\nТочность:");
for (const key of Object.keys(hits)) {
  console.log(`  ${key}: ${hits[key]}/${n} (${Math.round((hits[key] / n) * 100)}%), средняя уверенность ${(confidence[key] / n).toFixed(2)}`);
}
console.log(`Среднее время вызова: ${Math.round(totalMs / n)} мс`);
await laya.close();
