#!/usr/bin/env node
// Генератор демонстрационной истории нарядов «НарядAI».
//
// ВСЕ ДАННЫЕ ВЫМЫШЛЕННЫЕ. Люди, оборудование, наряды и цифры сгенерированы для демонстрации
// и не имеют отношения к реальному заводу АО «Костанайские минералы».
//
// Запуск (из корня репозитория, Node 20+, без npm-зависимостей):
//   node scripts/seed/generate.mjs
// Ключи берутся из apps/web/.env.local: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.
// ВНИМАНИЕ: скрипт сбрасывает все наряды (rpc reset_demo_orders) и создаёт историю заново.
// Справочники и учётные записи не удаляются: недостающее добавляется, существующее не меняется.
//
// Результат детерминирован: генератор случайных чисел с фиксированным зерном (SEED),
// поэтому повторный запуск даёт ту же историю (время «сейчас» округляется вниз до часа).
//
// ЗАЛОЖЕННЫЕ ЗАКОНОМЕРНОСТИ (ровно четыре, подробности в docs/demo-data.md):
//  a) Конвейер К-3 (INV-1002) ломается примерно втрое чаще остальных конвейеров,
//     чаще всего шифр М-02 (подшипник): повторяющийся отказ одного шифра на одной машине.
//  b) Исполнитель w07 (Ержанов Марат): около 30% его нарядов уходят на доработку, а после
//     ~40% его ремонтов в течение 7 дней на том же оборудовании случается повторная неисправность
//     с тем же шифром. Оценки ИИ и мастера у него низкие.
//  c) Дробилка КМД-1750 (INV-1001): внеплановые поломки через 1–5 суток после планового ремонта (ППР).
//  d) Ночная смена (20:00–08:00) на Участке обогащения: внеплановых нарядов примерно вдвое больше,
//     чем днём, и перерасход материала (масло И-40А списывается в 2–3 раза больше обычного).
// Кроме этого рейтинги разные: есть явно сильные исполнители (w08, w11, worker1) и слабые (w05, w14).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================
// Настройки
// ============================================================

const SEED = 20261008; // зерно генератора случайных чисел
const DAYS = 92; // глубина истории, суток
const N_UNPLANNED = 340; // фоновые внеплановые наряды (без заложенных закономерностей)
const TZ_HOURS = 5; // часовой пояс завода (UTC+5)
const BATCH = 200; // строк в одном запросе

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const toMs = (minutes) => Math.round(minutes * MIN); // минуты -> миллисекунды

// «Сейчас» — до часа вниз; полночь сегодняшнего дня по времени завода (в UTC-миллисекундах).
const NOW = Math.floor((process.env.SEED_NOW ? Date.parse(process.env.SEED_NOW) : Date.now()) / HOUR) * HOUR;
const DAY0 = Math.floor((NOW + TZ_HOURS * HOUR) / DAY) * DAY - TZ_HOURS * HOUR;

// ============================================================
// Случайные числа
// ============================================================

// mulberry32: маленький генератор с зерном. Одно зерно — одна и та же последовательность.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Набор помощников поверх генератора: целое, число в диапазоне, выбор, вероятность, взвешенный выбор.
function makeRand(next) {
  const api = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    range: (a, b) => a + next() * (b - a),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(items, weightOf) {
      const weights = items.map(weightOf);
      let x = next() * weights.reduce((s, w) => s + w, 0);
      for (let i = 0; i < items.length; i++) {
        x -= weights[i];
        if (x < 0) return items[i];
      }
      return items[items.length - 1];
    },
    uuid() {
      const hex = () => Math.floor(next() * 16).toString(16);
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        c === 'x' ? hex() : ((Math.floor(next() * 4) + 8).toString(16)),
      );
    },
  };
  return api;
}

const rng = makeRand(mulberry32(SEED));

// ============================================================
// Справочные данные (вымышленные)
// ============================================================

const SECTIONS = ['Участок дробления', 'Участок обогащения', 'Ремонтно-механический цех', 'Участок сушки и упаковки'];

// [название, инв. номер, участок, тип, критичность]. Первые шесть уже есть в seed.sql.
const EQUIPMENT = [
  ['Дробилка КМД-1750', 'INV-1001', 'Участок дробления', 'дробилка', 1],
  ['Конвейер К-3', 'INV-1002', 'Участок дробления', 'конвейер', 1],
  ['Насос шламовый НШ-2', 'INV-2001', 'Участок обогащения', 'насос', 1],
  ['Флотомашина ФМ-6', 'INV-2002', 'Участок обогащения', 'флотомашина', 2],
  ['Токарный станок 16К20', 'INV-3001', 'Ремонтно-механический цех', 'станок', 3],
  ['Сушильный барабан СБ-1', 'INV-4001', 'Участок сушки и упаковки', 'сушилка', 2],
  // новые 19
  ['Конвейер К-1', 'INV-1003', 'Участок дробления', 'конвейер', 2],
  ['Конвейер К-2', 'INV-1004', 'Участок дробления', 'конвейер', 2],
  ['Конвейер К-4', 'INV-1005', 'Участок дробления', 'конвейер', 2],
  ['Конвейер К-5', 'INV-1006', 'Участок дробления', 'конвейер', 2],
  ['Конвейер К-6', 'INV-1007', 'Участок дробления', 'конвейер', 3],
  ['Дробилка КСД-2200', 'INV-1008', 'Участок дробления', 'дробилка', 1],
  ['Грохот ГИТ-52', 'INV-1009', 'Участок дробления', 'грохот', 2],
  ['Питатель пластинчатый ПП-1', 'INV-1010', 'Участок дробления', 'питатель', 2],
  ['Мельница шаровая МШЦ-3600', 'INV-2003', 'Участок обогащения', 'мельница', 1],
  ['Мельница стержневая МСЦ-2700', 'INV-2004', 'Участок обогащения', 'мельница', 1],
  ['Насос шламовый НШ-3', 'INV-2005', 'Участок обогащения', 'насос', 2],
  ['Флотомашина ФМ-7', 'INV-2006', 'Участок обогащения', 'флотомашина', 2],
  ['Гидроциклон ГЦ-500', 'INV-2007', 'Участок обогащения', 'гидроциклон', 3],
  ['Фрезерный станок 6Р82', 'INV-3002', 'Ремонтно-механический цех', 'станок', 3],
  ['Кран-балка КБ-5', 'INV-3003', 'Ремонтно-механический цех', 'кран', 2],
  ['Пресс гидравлический ПГ-100', 'INV-3004', 'Ремонтно-механический цех', 'пресс', 3],
  ['Сушильный барабан СБ-2', 'INV-4002', 'Участок сушки и упаковки', 'сушилка', 2],
  ['Компрессор винтовой ВК-30', 'INV-4003', 'Участок сушки и упаковки', 'компрессор', 2],
  ['Питатель-дозатор ПД-2', 'INV-4004', 'Участок сушки и упаковки', 'дозатор', 3],
];

// Шифры из seed.sql (категории по п. 5.4 кейса).
const FAULT_CODES = [
  ['М-01', 'М', 'Износ футеровки', 6.0],
  ['М-02', 'М', 'Отказ подшипника', 3.0],
  ['М-03', 'М', 'Обрыв или износ конвейерной ленты', 4.0],
  ['М-04', 'М', 'Ослабление крепежа', 1.0],
  ['М-05', 'М', 'Износ уплотнения вала', 2.0],
  ['Э-01', 'Э', 'Отказ электродвигателя', 4.0],
  ['Э-02', 'Э', 'Обрыв кабеля питания', 2.0],
  ['Э-03', 'Э', 'Срабатывание защиты', 1.0],
  ['Э-04', 'Э', 'Неисправность датчика', 1.5],
  ['Г-01', 'Г', 'Течь масла', 2.0],
  ['Г-02', 'Г', 'Отказ гидронасоса', 5.0],
  ['Г-03', 'Г', 'Повреждение рукава высокого давления', 1.5],
  ['Г-04', 'Г', 'Падение давления в системе', 2.5],
  ['П-01', 'П', 'Утечка воздуха', 1.0],
  ['П-02', 'П', 'Отказ пневмоцилиндра', 2.0],
  ['П-03', 'П', 'Засор пневмолинии', 1.0],
  ['С-01', 'С', 'Недостаток смазки', 0.5],
  ['С-02', 'С', 'Загрязнение смазки', 1.0],
  ['С-03', 'С', 'Отказ системы централизованной смазки', 3.0],
  ['С-04', 'С', 'Перегрев узла из-за смазки', 1.5],
];

// [название, единица, обычный расход, шифры]. Первые десять уже есть в seed.sql.
const MATERIALS = [
  ['Подшипник 6312', 'шт', 2, ['М-02']],
  ['Подшипник 22320', 'шт', 1, ['М-02']],
  ['Лента конвейерная, м', 'м', 10, ['М-03']],
  ['Болт М16 с гайкой', 'шт', 8, ['М-04']],
  ['Манжета армированная', 'шт', 2, ['М-05', 'Г-01']],
  ['Масло индустриальное И-40А', 'л', 5, ['Г-01', 'С-01', 'С-02']],
  ['Рукав РВД 1/2"', 'шт', 1, ['Г-03']],
  ['Кабель ВВГ 3х2,5', 'м', 10, ['Э-02']],
  ['Смазка Литол-24', 'кг', 1, ['С-01', 'С-04']],
  ['Фитинг пневматический', 'шт', 2, ['П-01', 'П-03']],
  // новые 30
  ['Подшипник 6314', 'шт', 2, ['М-02']],
  ['Подшипник роликовый 3620', 'шт', 1, ['М-02']],
  ['Плита футеровочная', 'шт', 4, ['М-01']],
  ['Электроды УОНИ-13/55', 'кг', 2, ['М-01']],
  ['Скребок очистной ленты', 'шт', 1, ['М-03']],
  ['Клей для вулканизации ленты', 'л', 1, ['М-03']],
  ['Болт М20 с гайкой', 'шт', 6, ['М-04']],
  ['Шайба Гровера М16', 'шт', 10, ['М-04']],
  ['Шпилька М24', 'шт', 4, ['М-04']],
  ['Набивка сальниковая', 'кг', 1, ['М-05']],
  ['Кольцо уплотнительное резиновое', 'шт', 4, ['М-05', 'Г-01']],
  ['Щётки угольные для двигателя', 'компл', 1, ['Э-01']],
  ['Подшипник электродвигателя 6210', 'шт', 2, ['Э-01', 'М-02']],
  ['Кабель КГ 3х16', 'м', 6, ['Э-02']],
  ['Муфта кабельная соединительная', 'шт', 1, ['Э-02']],
  ['Автоматический выключатель 25А', 'шт', 1, ['Э-03']],
  ['Контактор магнитный', 'шт', 1, ['Э-03', 'Э-01']],
  ['Датчик температуры', 'шт', 1, ['Э-04']],
  ['Датчик индуктивный', 'шт', 1, ['Э-04']],
  ['Масло гидравлическое МГЕ-46В', 'л', 10, ['Г-01', 'Г-04']],
  ['Ремкомплект гидронасоса', 'компл', 1, ['Г-02']],
  ['Фильтр гидравлический', 'шт', 1, ['Г-02', 'Г-04']],
  ['Рукав РВД 3/4"', 'шт', 1, ['Г-03']],
  ['Фитинг для РВД', 'шт', 2, ['Г-03']],
  ['Ремкомплект пневмоцилиндра', 'компл', 1, ['П-02']],
  ['Трубка пневматическая ПУ 8 мм', 'м', 5, ['П-01', 'П-03']],
  ['Глушитель пневматический', 'шт', 2, ['П-03']],
  ['Смазка ЦИАТИМ-221', 'кг', 1, ['С-01', 'С-02']],
  ['Масло редукторное ТАД-17', 'л', 8, ['С-03', 'С-02']],
  ['Пресс-маслёнка', 'шт', 4, ['С-01', 'С-03']],
];

// Какие шифры бывают у какого типа оборудования: [шифр, вес].
const TYPE_CODES = {
  конвейер: [['М-03', 3], ['М-02', 2], ['М-04', 1.5], ['Э-01', 1], ['С-01', 1], ['Э-04', 1], ['Э-02', 0.5]],
  дробилка: [['М-01', 3], ['М-02', 2], ['Г-01', 1], ['Э-01', 1], ['С-03', 1], ['Э-03', 1]],
  мельница: [['М-01', 2], ['М-02', 2], ['М-05', 1.5], ['Э-01', 1], ['С-03', 1], ['Г-01', 1]],
  насос: [['М-05', 3], ['М-02', 2], ['Э-01', 1.5], ['Э-03', 1], ['Г-04', 1]],
  флотомашина: [['М-02', 2], ['Э-01', 1.5], ['М-05', 1.5], ['Э-04', 1], ['С-01', 1]],
  гидроциклон: [['М-01', 2], ['М-04', 1], ['Э-04', 1]],
  грохот: [['М-02', 2], ['М-04', 2], ['Э-01', 1], ['М-01', 1]],
  питатель: [['М-02', 2], ['П-02', 1.5], ['Э-01', 1], ['М-04', 1.5], ['Г-03', 1]],
  дозатор: [['П-02', 2], ['Э-04', 2], ['П-03', 1], ['М-04', 1]],
  сушилка: [['М-02', 2], ['Э-01', 1.5], ['М-04', 1.5], ['С-03', 1], ['С-04', 1.5], ['Э-04', 1]],
  компрессор: [['П-01', 3], ['П-03', 1.5], ['Э-01', 1], ['С-02', 1.5], ['М-02', 1], ['Э-03', 1]],
  станок: [['Э-03', 1.5], ['С-01', 1.5], ['М-02', 1], ['С-03', 1], ['Э-04', 1]],
  кран: [['Э-02', 1.5], ['Э-03', 1.5], ['М-02', 1], ['М-04', 1]],
  пресс: [['Г-01', 3], ['Г-02', 1.5], ['Г-03', 2], ['Г-04', 2]],
};
const DEFAULT_CODES = [['М-02', 2], ['М-04', 1.5], ['Э-01', 1], ['С-01', 1]];

// Описание неисправности и записи о выполненных работах по шифрам (названия оборудования подставляются отдельно).
const DESC = {
  'М-01': ['сильный износ футеровки, видны сквозные протирания', 'износ футеровочных плит, выпал крепёж', 'футеровка изношена, просыпь материала через зазоры'],
  'М-02': ['повышенный шум и нагрев подшипника, вибрация выше нормы', 'отказ подшипникового узла, заклинивание вала', 'гул и вибрация в подшипнике, греется корпус'],
  'М-03': ['порыв ленты, лента сходит с барабана', 'расслоение ленты по краю, просыпь материала', 'лента перекошена и трётся о раму'],
  'М-04': ['ослабло крепление, появился стук при работе', 'ослабли болты крепления рамы, вибрация', 'срезан болт крепления кожуха'],
  'М-05': ['течь через уплотнение вала', 'износ сальникового уплотнения, подтёки', 'пропускает уплотнение вала, вода попадает в узел'],
  'Э-01': ['электродвигатель не запускается, гудит', 'перегрев электродвигателя, срабатывает тепловая защита', 'нет вращения двигателя после пуска'],
  'Э-02': ['обрыв кабеля питания, нет напряжения на двигателе', 'повреждена изоляция питающего кабеля', 'пропадает питание, кабель повреждён'],
  'Э-03': ['ложное срабатывание защиты, автомат отключается', 'выбивает автомат при пуске', 'срабатывает защита по току, пуск невозможен'],
  'Э-04': ['датчик не даёт показаний, ложные сигналы на пульте', 'неисправен датчик температуры подшипника', 'нет сигнала датчика на пульт оператора'],
  'Г-01': ['течь масла из гидросистемы, лужа под узлом', 'подтёки масла на соединениях', 'падает уровень масла, течь по штоку'],
  'Г-02': ['гидронасос не создаёт давление', 'шум и вибрация гидронасоса, давление не набирается', 'отказ гидронасоса, механизм не двигается'],
  'Г-03': ['поврежден рукав высокого давления, течь', 'порыв РВД, масло на полу', 'РВД протёрт о раму, течь'],
  'Г-04': ['падает давление в гидросистеме', 'не держит давление, самопроизвольное опускание', 'нестабильное давление в системе'],
  'П-01': ['утечка воздуха в магистрали, шипит', 'воздух не держит давление, частые пуски компрессора', 'свищ на пневмолинии'],
  'П-02': ['пневмоцилиндр не доходит до упора', 'заедает шток пневмоцилиндра', 'пневмоцилиндр работает рывками'],
  'П-03': ['засорена пневмолиния, слабый поток', 'забит фильтр пневмолинии, влага в системе', 'не продувается линия подачи воздуха'],
  'С-01': ['не хватает смазки в узлах, скрип', 'сухие узлы трения, пора смазывать', 'нет смазки в подшипниках, повышенный нагрев'],
  'С-02': ['загрязнена смазка, в масле пыль и стружка', 'смазка потемнела и загрязнена', 'в масле вода, нужна замена'],
  'С-03': ['не работает централизованная смазка, нет подачи', 'отказ насоса смазки, узлы без масла', 'засор магистрали централизованной смазки'],
  'С-04': ['перегрев узла из-за недостатка смазки', 'узел греется, смазка выработана', 'перегрев корпуса подшипника, запах гари'],
};
const WORK = {
  'М-01': ['Заменены изношенные плиты футеровки, подтянут крепёж.', 'Выполнена наплавка и замена футеровки, проверена герметичность.'],
  'М-02': ['Заменён подшипник, узел промыт и смазан, вибрация в норме.', 'Демонтирован отказавший подшипник, установлен новый, нагрев после пуска в норме.'],
  'М-03': ['Заменён участок ленты, выставлен ход, натяжение отрегулировано.', 'Вулканизирован стык ленты, отрегулирован центровой ход.'],
  'М-04': ['Подтянуты и заменены болты крепления, вибрация в норме.', 'Заменены срезанные болты, установлены стопорные шайбы.'],
  'М-05': ['Заменено уплотнение вала, подтёков нет.', 'Заменены манжеты и набивка, обкатка без течи.'],
  'Э-01': ['Заменены щётки, проверена изоляция обмоток, двигатель запущен.', 'Двигатель разобран, заменены подшипники, замеры в норме.'],
  'Э-02': ['Проложен новый участок кабеля, выполнена опрессовка, питание восстановлено.', 'Заменён повреждённый кабель, изоляция проверена мегаомметром.'],
  'Э-03': ['Проверены и подтянуты контакты, заменён автомат, защита настроена.', 'Проверена уставка защиты, заменён контактор.'],
  'Э-04': ['Заменён датчик, сигнал на пульте появился.', 'Датчик заменён и откалиброван, сигнал стабильный.'],
  'Г-01': ['Заменены уплотнения, масло долито, течь устранена.', 'Подтянуты соединения, заменено кольцо, масло долито до уровня.'],
  'Г-02': ['Заменён ремкомплект гидронасоса, давление восстановлено.', 'Гидронасос перебран, заменены фильтр и масло, давление в норме.'],
  'Г-03': ['Заменён РВД, система опрессована.', 'Заменены рукав и фитинг, течи нет.'],
  'Г-04': ['Заменён фильтр, из системы удалён воздух, давление в норме.', 'Найдена и устранена утечка, давление держится.'],
  'П-01': ['Заменены фитинги и трубка, утечка устранена.', 'Устранена утечка на магистрали, давление держится.'],
  'П-02': ['Заменён ремкомплект пневмоцилиндра, ход полный.', 'Цилиндр очищен и смазан, заменены уплотнения.'],
  'П-03': ['Линия продута, заменён фильтр, влага удалена.', 'Заменены глушитель и фильтр, поток восстановлен.'],
  'С-01': ['Узлы смазаны, смазка добавлена во все точки.', 'Выполнена смазка узлов по карте смазки.'],
  'С-02': ['Слито загрязнённое масло, система промыта, залито свежее.', 'Заменена смазка, очищены пресс-маслёнки.'],
  'С-03': ['Прочищена магистраль, заменена пресс-маслёнка, подача восстановлена.', 'Отремонтирован насос смазки, подача проверена на каждой точке.'],
  'С-04': ['Заменена смазка, узел остыл, температура в норме.', 'Промыт узел, залита новая смазка, нагрев устранён.'],
};
// Плановые работы: шифр -> тексты.
const PLAN_DESC = {
  'С-01': ['плановое ТО: смазка узлов по карте смазки', 'плановая смазка и осмотр узлов'],
  'С-02': ['плановая замена масла и очистка маслосистемы'],
  'М-04': ['ППР: осмотр, подтяжка крепежа', 'плановый осмотр рамы и крепежа'],
  'Э-03': ['плановый осмотр электрооборудования и проверка защит'],
  'М-05': ['ППР: ревизия уплотнений вала'],
  'М-01': ['ППР: ревизия и подтяжка футеровки'],
};

const REJECT_REASONS = [
  ['no_materials', 'Нет нужных материалов на складе'],
  ['no_permit', 'Нет допуска на эту работу'],
  ['busy_emergency', 'Занят на аварийном наряде'],
  ['other', 'Не могу выполнить, прошу передать другому'],
];
const PAUSE_REASONS = [
  ['waiting_parts', 'Ждём запчасть со склада', 4],
  ['waiting_permit', 'Ждём оформления допуска', 2],
  ['waiting_stop', 'Ждём остановки оборудования', 2],
  ['other', 'Вызвали на другой участок, вернусь позже', 1.5],
];
const EXCUSED_PAUSES = ['waiting_parts', 'waiting_permit', 'waiting_stop'];
const REWORK_REASONS = [
  'Описание работ не подтверждает устранение неисправности, повторите работу',
  'Неисправность не устранена: узел продолжает греться',
  'Работа выполнена не полностью, остался шум и вибрация',
];
const CANCEL_REASONS = [
  'Наряд создан по ошибке',
  'Дублирует другой наряд',
  'Неисправность устранена силами эксплуатации',
  'Оборудование выведено в резерв',
];
const MASTER_LOWER = [
  'Качество ниже ожидаемого: замечания по сборке узла',
  'Не убрано рабочее место, есть замечания по аккуратности',
];
const MASTER_RAISE = [
  'Работа выполнена аккуратно и быстро, оценка повышена',
  'Исполнитель сам нашёл и устранил сопутствующую неисправность',
];

// Сотрудники, которых добавляет генератор (без учётных записей). Существующие: master1, worker1-3, lead1.
const NEW_EMPLOYEES = [
  ['master2', 'Касымов Ермек', 'master', null, null, null, 'B'],
  ['w04', 'Нурпеисов Азамат', 'worker', 'слесарь', 4, 'Бригада 1', 'A'],
  ['w05', 'Бекмуратов Нуржан', 'worker', 'слесарь', 3, 'Бригада 1', 'A'],
  ['w06', 'Лебедев Сергей', 'worker', 'электрик', 5, 'Бригада 1', 'A'],
  ['w07', 'Ержанов Марат', 'worker', 'слесарь', 3, 'Бригада 2', 'A'],
  ['w08', 'Петров Андрей', 'worker', 'слесарь', 5, 'Бригада 2', 'A'],
  ['w09', 'Сейтказин Айбек', 'worker', 'сварщик', 5, 'Бригада 2', 'B'],
  ['w10', 'Мухамедов Рустем', 'worker', 'слесарь', 4, 'Бригада 2', 'B'],
  ['w11', 'Оспанов Талгат', 'worker', 'слесарь', 6, 'Бригада 3', 'B'],
  ['w12', 'Громов Алексей', 'worker', 'электрик', 4, 'Бригада 3', 'B'],
  ['w13', 'Абдрахманов Кайрат', 'worker', 'слесарь', 4, 'Бригада 3', 'B'],
  ['w14', 'Тулегенов Санжар', 'worker', 'сварщик', 3, 'Бригада 3', 'B'],
  ['w15', 'Ли Станислав', 'worker', 'слесарь', 4, 'Бригада 3', 'B'],
];

// Профили исполнителей: вероятность опоздания, доля слабых работ, как часто мастер снижает оценку.
const PROFILES = {
  strong: { late: 0.005, poor: 0.0, lower: 0 },
  average: { late: 0.02, poor: 0.04, lower: 0 },
  weak: { late: 0.06, poor: 0.12, lower: 0 },
  problem: { late: 0.1, poor: 0.3, lower: 0.9 }, // w07, закономерность b
};
const WORKER_PROFILE = { worker1: 'strong', w08: 'strong', w11: 'strong', w05: 'weak', w14: 'weak', w07: 'problem' };
const PROBLEM_WORKER = 'w07';
const REPEAT_P = 0.4; // доля ремонтов w07 с повторной неисправностью в течение 7 дней

const EQ_K3 = 'INV-1002'; // закономерность a
const EQ_KMD = 'INV-1001'; // закономерность c
const SECTION_ENRICH = 'Участок обогащения'; // закономерность d
const OIL = 'Масло индустриальное И-40А';

// ============================================================
// Работа с Supabase REST
// ============================================================

function loadEnv() {
  const env = { ...process.env };
  try {
    const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/web/.env.local');
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // файла нет — возьмём переменные окружения
  }
  return env;
}

const env = loadEnv();
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error('Не найдены NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local).');
  process.exit(1);
}

// Запрос к REST. При ошибке печатаем статус и тело ответа (ключ не печатаем) и выходим.
async function rest(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}/rest/v1${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Ошибка ${method} ${path}: ${res.status}\n${text}`);
    process.exit(1);
  }
  return { res, data: text ? JSON.parse(text) : null };
}

async function insertBatches(table, rows, query = '', prefer = 'return=minimal') {
  for (let i = 0; i < rows.length; i += BATCH) {
    await rest('POST', `/${table}${query}`, rows.slice(i, i + BATCH), { Prefer: prefer });
  }
}

async function countRows(table) {
  const { res } = await rest('GET', `/${table}?select=*&limit=1`, undefined, { Prefer: 'count=exact' });
  return Number(res.headers.get('content-range').split('/')[1]);
}

// ============================================================
// Шаг 1–2. Сброс и справочники
// ============================================================

console.log('Шаг 1. Сброс нарядов (reset_demo_orders)...');
await rest('POST', '/rpc/reset_demo_orders', {});

console.log('Шаг 2. Справочники...');
const ignore = 'resolution=ignore-duplicates,return=minimal'; // существующие строки не меняем

await insertBatches('sections', SECTIONS.map((name) => ({ name })), '?on_conflict=name', ignore);
const sectionByName = new Map((await rest('GET', '/sections?select=id,name')).data.map((s) => [s.name, s.id]));

await insertBatches(
  'equipment',
  EQUIPMENT.map(([name, inv, section, type, criticality]) => ({
    name,
    inventory_no: inv,
    section_id: sectionByName.get(section),
    type,
    criticality,
    qr_code: `EQ-${inv}`,
  })),
  '?on_conflict=inventory_no',
  ignore,
);
await insertBatches(
  'fault_codes',
  FAULT_CODES.map(([code, category, name, norm_hours]) => ({ code, category, name, norm_hours })),
  '?on_conflict=code',
  ignore,
);
await insertBatches(
  'materials',
  MATERIALS.map(([name, unit, typical_qty, fault_codes]) => ({ name, unit, typical_qty, fault_codes })),
  '?on_conflict=name',
  ignore,
);
await insertBatches(
  'employees',
  NEW_EMPLOYEES.map(([login, full_name, role, specialty, grade, brigade, shift]) => ({
    login,
    full_name,
    role,
    specialty,
    grade,
    brigade,
    shift,
  })),
  '?on_conflict=login',
  ignore,
);

// Читаем справочники обратно: нужны id.
const equipment = (await rest('GET', '/equipment?select=id,name,inventory_no,section_id,type&order=inventory_no')).data;
const sectionNameById = new Map([...sectionByName].map(([n, id]) => [id, n]));
const faultByCode = new Map((await rest('GET', '/fault_codes?select=code,category,name,norm_hours')).data.map((f) => [f.code, f]));
const materials = (await rest('GET', '/materials?select=id,name,unit,typical_qty,fault_codes&order=name')).data.map((m) => ({
  ...m,
  typical_qty: Number(m.typical_qty),
}));
const employees = (await rest('GET', '/employees?select=id,login,full_name,role,specialty,grade,brigade,shift&order=login')).data;
const employeeById = new Map(employees.map((e) => [e.id, e]));
const eqByInv = new Map(equipment.map((e) => [e.inventory_no, e]));
const workers = employees.filter((e) => e.role === 'worker');
const master1 = employees.find((e) => e.login === 'master1');
const master2 = employees.find((e) => e.login === 'master2');
if (!master1 || !master2 || workers.length !== 15 || equipment.length < 25 || materials.length < 40) {
  console.error(`Справочники неполные: workers=${workers.length}, equipment=${equipment.length}, materials=${materials.length}`);
  process.exit(1);
}
const oilMaterial = materials.find((m) => m.name === OIL);

// ============================================================
// Помощники по времени, сменам и сотрудникам
// ============================================================

// Смена по часу создания наряда (по времени завода): день 08–20 — A, ночь 20–08 — B.
function shiftOf(ms) {
  const hour = Math.floor((((ms - DAY0) % DAY) + DAY) % DAY / HOUR);
  return hour >= 8 && hour < 20 ? 'A' : 'B';
}

// Случайный момент в заданной смене в один из последних DAYS дней (до вчерашнего включительно).
function randomTime(shift) {
  const daysAgo = rng.int(1, DAYS);
  const hour = shift === 'A' ? rng.int(8, 19) : rng.pick([20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
  return DAY0 - daysAgo * DAY + hour * HOUR + rng.int(0, 59) * MIN;
}

// Какая специальность нужна для шифра: Э — электрик, футеровка и часть крепежа — сварщик, остальное — слесарь.
function specialtyFor(code, r) {
  if (faultByCode.get(code).category === 'Э') return 'электрик';
  if ((code === 'М-01' && r.chance(0.9)) || (code === 'М-04' && r.chance(0.25))) return 'сварщик';
  return 'слесарь';
}

function pickWorker(r, specialty, shift, excludeLogin = null) {
  // Сварщиков мало, поэтому для них смену не учитываем.
  const anyShift = specialty === 'сварщик';
  let pool = workers.filter((w) => w.specialty === specialty && (anyShift || w.shift === shift) && w.login !== excludeLogin);
  if (pool.length === 0) pool = workers.filter((w) => w.specialty === specialty && w.login !== excludeLogin);
  return r.pick(pool);
}

// ============================================================
// Проверки кода и вердикт ИИ (упрощённая копия apps/web/lib/ai/rules.ts и decide из review.ts)
// Тексты совпадают со словарём messages/ru.json, раздел ai.rules.
// ============================================================

function runRules(i) {
  const checks = [];
  for (const m of i.materials) {
    const ratio = m.typical > 0 ? m.qty / m.typical : 1;
    const text = (s) => s.replace('{name}', m.name).replace('{qty}', m.qty).replace('{unit}', m.unit).replace('{typical}', m.typical).replace('{ratio}', ratio.toFixed(1));
    if (ratio > 2) checks.push({ id: `material_over:${m.name}`, status: 'fail', message: text('{name}: списано {qty} {unit} при обычном расходе {typical} — в {ratio} раза больше.') });
    else if (ratio > 1.5) checks.push({ id: `material_high:${m.name}`, status: 'warn', message: text('{name}: списано {qty} {unit} при обычном расходе {typical}.') });
  }
  const actual = Math.max(0, Math.round((i.doneOff - i.startedOff) / MIN - i.excusedMin));
  const norm = Math.round(i.norm * 60);
  if (actual > norm * 1.5) checks.push({ id: 'time_long', status: 'warn', message: `Работа заняла ${actual} мин при нормативе ${norm} мин.` });
  else checks.push({ id: 'time_ok', status: 'ok', message: `Время работы ${actual} мин в пределах норматива ${norm} мин.` });
  const late = (i.doneOff - i.dueOff) / MIN;
  if (late > 0) checks.push({ id: 'late', status: 'warn', message: `Сдан позже срока на ${Math.round(late)} мин.` });
  if (!checks.some((c) => c.status !== 'ok')) checks.push({ id: 'complete', status: 'ok', message: 'Закрытие заполнено полностью.' });
  return checks;
}

function rulesScore(checks) {
  const penalty = checks.reduce((s, c) => s + (c.status === 'fail' ? 2 : c.status === 'warn' ? 0.5 : 0), 0);
  return Math.min(5, Math.max(1, Math.round(5 - penalty)));
}

// Вердикт ИИ: сначала явные ошибки, потом сомнения, потом замечания. Порог уверенности 0,6.
function decide(rules, workMatch, hadAiError) {
  const fails = rules.filter((c) => c.status === 'fail').length;
  const warns = rules.filter((c) => c.status === 'warn').length;
  const score = rulesScore(rules);
  const confidence = workMatch ? workMatch.confidence : 1;
  if (fails > 0) return { verdict: 'rework', score: Math.min(score, 2), confidence: 1 };
  if (workMatch && !workMatch.matches && workMatch.confidence >= 0.6) return { verdict: 'rework', score: Math.min(score, 2), confidence };
  if (hadAiError || confidence < 0.6) return { verdict: 'needs_master', score, confidence };
  if (warns > 0) return { verdict: 'accept_with_note', score: Math.min(score, 4), confidence };
  return { verdict: 'accept', score, confidence };
}

// Проверка одного закрытия: правила + (если модель «работала») соответствие работ проблеме.
function makeReview(r, a) {
  const rules = runRules(a);
  const llmDown = a.llmDown;
  const workMatch = llmDown
    ? null
    : {
        matches: !a.poor,
        confidence: Math.round(r.range(a.poor ? 0.7 : 0.78, a.poor ? 0.9 : 0.96) * 100) / 100,
        explanation: a.poor
          ? `Описание работ слишком общее, устранение неисправности «${a.faultName}» не подтверждено.`
          : `Описанные работы соответствуют неисправности «${a.faultName}».`,
      };
  const res = decide(rules, workMatch, llmDown);
  const bad = rules.filter((c) => c.status !== 'ok').map((c) => c.message);
  const good = rules.filter((c) => c.status === 'ok').map((c) => c.message);
  if (workMatch?.matches) good.push(`Работы соответствуют неисправности «${a.faultName}».`);
  if (a.poor) bad.push('Уточните, что именно сделано с узлом.');
  let summary;
  if (res.verdict === 'accept') summary = 'Работы соответствуют неисправности, закрытие заполнено полностью.';
  else if (res.verdict === 'accept_with_note') summary = `Работы выполнены, но есть замечания: ${bad.join(' ')}`;
  else if (res.verdict === 'needs_master') summary = 'Языковая модель недоступна, проверка по правилам не завершена. Решение за мастером.';
  else summary = a.poor ? 'Описание работ не подтверждает устранение неисправности. Нужна доработка.' : `Есть ошибки в закрытии: ${bad.join(' ')}`;
  return {
    verdict: res.verdict,
    score: res.score,
    confidence: Math.round(res.confidence * 100) / 100,
    explanation: summary,
    source: llmDown ? 'rules' : 'llm',
    // форма ReviewChecks из apps/web/lib/ai/types.ts
    checks: {
      rules,
      work_match: workMatch,
      photo: null,
      text: { good, improve: bad, summary },
      provider: 'cloud',
      errors: llmDown ? ['Языковая модель недоступна, проверка выполнена по правилам'] : [],
    },
  };
}

// Материалы закрытия: связанные с шифром, расход около обычного; при overuse — масло в 2–3 раза больше.
function pickMaterials(r, code, overuse) {
  const cands = materials.filter((m) => m.fault_codes.includes(code));
  const normalQty = (m) => {
    const q = m.typical_qty * r.range(0.7, 1.3);
    return ['шт', 'компл'].includes(m.unit) ? Math.max(1, Math.round(q)) : Math.max(0.5, Math.round(q * 2) / 2);
  };
  const list = [];
  if (overuse) {
    list.push({ material: oilMaterial, qty: Math.ceil(oilMaterial.typical_qty * r.range(2.05, 3)) });
    const others = cands.filter((m) => m.id !== oilMaterial.id);
    if (others.length && r.chance(0.4)) list.push({ material: r.pick(others), qty: 0 });
  } else {
    const first = r.pick(cands);
    list.push({ material: first, qty: 0 });
    const others = cands.filter((m) => m.id !== first.id);
    if (others.length && r.chance(0.35)) list.push({ material: r.pick(others), qty: 0 });
  }
  for (const item of list) if (!item.qty) item.qty = normalQty(item.material);
  return list;
}

// ============================================================
// Сборка одного наряда: поля, журнал, материалы, проверки ИИ.
// Функция чистая: из spec и времени создания всегда выходит одно и то же (зерно внутри spec).
// Времена внутри считаются сдвигами в миллисекундах от created_at.
// ============================================================

function buildOrder(spec, createdMs) {
  const r = makeRand(mulberry32(spec.seed));
  const { eq, code, master } = spec;
  const fc = faultByCode.get(code);
  const norm = Number(fc.norm_hours);
  const prof = PROFILES[WORKER_PROFILE[spec.worker.login] ?? 'average'];
  const stop = spec.stopAt ?? null; // где остановился открытый или отменённый наряд

  const events = [];
  const add = (action, actor, from, to, off, extra = {}) =>
    events.push({
      action,
      actor_id: actor ? actor.id : null,
      from_status: from,
      to_status: to,
      off,
      comment: extra.comment ?? null,
      reason: extra.reason ?? null,
      reason_code: extra.reason_code ?? null,
    });

  const dueOff = toMs(norm * 60 * r.range(1.5, 3)); // срок: норматив × 1,5–3
  const availMin = dueOff / MIN;
  let assignee = spec.worker;
  let status = 'issued';
  let t = 0;
  let acceptedOff = null;
  let startedOff = null;
  let doneOff = null;
  let closedOff = null;
  let workDone = null;
  let usages = [];
  const reviews = []; // {off, ...review, master_score, master_reason}

  add('issue', master, null, 'issued', 0);

  // Собираем итог. Для отменённого наряда добавляем событие отмены.
  const finalize = () => {
    if (spec.cancel) {
      t += toMs(r.int(10, 120));
      add('cancel', master, status, 'cancelled', t, { reason: r.pick(CANCEL_REASONS), reason_code: 'other' });
      status = 'cancelled';
    }
    const abs = (off) => new Date(createdMs + off).toISOString();
    const lastOff = events[events.length - 1].off;
    const order = {
      id: spec.id,
      type: spec.type,
      description: spec.description,
      comment: null,
      section_id: eq.section_id,
      equipment_id: eq.id,
      assignee_id: assignee.id,
      brigade: null,
      master_id: master.id,
      priority: spec.priority,
      due_at: abs(dueOff),
      status,
      fault_code: code,
      needs_permit: r.chance(fc.category === 'Э' || code === 'М-01' ? 0.5 : 0.05),
      parent_order_id: spec.parentId ?? null,
      work_done: workDone,
      close_comment: null,
      accepted_at: acceptedOff === null ? null : abs(acceptedOff),
      started_at: startedOff === null ? null : abs(startedOff),
      done_at: doneOff === null ? null : abs(doneOff),
      closed_at: closedOff === null ? null : abs(closedOff),
      created_at: abs(0),
      updated_at: abs(lastOff),
    };
    return {
      order,
      events: events.map((e) => ({
        order_id: spec.id,
        actor_id: e.actor_id,
        action: e.action,
        from_status: e.from_status,
        to_status: e.to_status,
        comment: e.comment,
        reason: e.reason,
        reason_code: e.reason_code,
        created_at: abs(e.off),
      })),
      usages: usages.map((u) => ({ order_id: spec.id, material_id: u.material.id, qty: u.qty })),
      reviews: reviews.map((v) => ({
        order_id: spec.id,
        verdict: v.verdict,
        score: v.score,
        confidence: v.confidence,
        checks: v.checks,
        explanation: v.explanation,
        source: v.source,
        master_score: v.master_score ?? null,
        master_reason: v.master_reason ?? null,
        created_at: abs(v.off),
      })),
      lastOff,
      assigneeLogin: assignee.login,
    };
  };

  // 1. Отказ и переназначение (около 2% нарядов).
  if (spec.reject) {
    t += toMs(r.int(4, 20));
    const [rc, rt] = r.pick(REJECT_REASONS);
    add('reject', assignee, 'issued', 'rejected', t, { reason: rt, reason_code: rc });
    t += toMs(r.int(3, 15));
    assignee = spec.worker2;
    add('reassign', master, 'rejected', 'issued', t, { comment: `Переназначен: ${assignee.full_name}` });
  }
  if (stop === 'issued') return finalize();

  // 2. Принятие (иногда через очередь).
  let from = 'issued';
  if (spec.queue) {
    t += toMs(r.int(1, 5));
    add('queue', assignee, 'issued', 'queued', t);
    from = 'queued';
    t += toMs(r.int(20, 60));
  } else {
    const slow = spec.priority === 'emergency' ? r.int(1, 4) : r.int(3, 25);
    t += toMs(Math.min(slow, Math.max(2, availMin * 0.1)));
  }
  add('accept', assignee, from, 'accepted', t);
  acceptedOff = t;
  status = 'accepted';
  if (stop === 'accepted') return finalize();

  // 3. Начало работ.
  t += toMs(Math.min(r.int(2, 30), Math.max(2, availMin * 0.15)));
  add('start', assignee, 'accepted', 'in_progress', t);
  startedOff = t;
  status = 'in_progress';
  if (stop === 'in_progress') return finalize();

  // 4. Работа, возможно с паузой.
  let work = norm * 60 * r.range(0.7, 1.3); // минут
  let wantPause = stop === 'paused' || (!stop && work > 60 && r.chance(0.14));
  let pauseDur = wantPause ? r.int(15, 120) : 0;
  let pauseAt = work * r.range(0.3, 0.6);
  const [pauseCode, pauseText] = wantPause ? r.weighted(PAUSE_REASONS, (p) => p[2]) : [null, null];
  if (!stop) {
    if (spec.late) {
      // Просрочка: сдача на 15–180 минут позже срока.
      const total = availMin + r.int(15, 180) - t / MIN;
      work = Math.max(work, total - pauseDur);
    } else {
      // В срок: сжимаем работу, чтобы уложиться (с запасом 5 минут). Если не выходит — паузу убираем.
      if (pauseDur && availMin - 5 - t / MIN - pauseDur < 25) {
        pauseDur = 0;
        wantPause = false;
      }
      work = Math.min(work, Math.max(10, availMin - 5 - t / MIN - pauseDur));
    }
    pauseAt = Math.min(pauseAt, work * 0.8);
  }
  if (wantPause) {
    add('pause', assignee, 'in_progress', 'paused', t + toMs(pauseAt), { reason: pauseText, reason_code: pauseCode });
    status = 'paused';
    if (stop === 'paused') return finalize();
    add('resume', assignee, 'paused', 'in_progress', t + toMs(pauseAt + pauseDur));
    status = 'in_progress';
  }
  t += toMs(work + pauseDur);
  const excusedMin = wantPause && EXCUSED_PAUSES.includes(pauseCode) ? pauseDur : 0;

  // 5. Исполнено: материалы, отправка на проверку ИИ.
  doneOff = t;
  add('done', assignee, 'in_progress', 'done', t);
  add('send_to_review', null, 'done', 'ai_review', t + 2000);
  status = 'ai_review';
  workDone = r.pick(WORK[code]);
  usages = pickMaterials(r, code, spec.overuse);
  const matInfo = usages.map((u) => ({ name: u.material.name, unit: u.material.unit, qty: u.qty, typical: u.material.typical_qty }));
  const review = (poor, llmDown, done) =>
    makeReview(r, { materials: matInfo, norm, startedOff, doneOff: done, dueOff, excusedMin, poor, llmDown, faultName: fc.name });

  // Слабая работа: ИИ видит, что описание не подтверждает ремонт (кроме нарядов с перерасходом масла).
  let poor = spec.overuse || stop === 'ai_review' ? false : stop === 'rework' ? true : r.chance(prof.poor);
  const llmDown = !poor && !stop && r.chance(0.04);
  let tv = t + 2000 + toMs(r.int(8, 40) / 60);
  let rv = review(poor, llmDown, doneOff);
  add('ai_verdict', null, 'ai_review', 'ai_review', tv, { comment: `${rv.verdict}, ${rv.score}/5` });
  reviews.push({ ...rv, off: tv });
  if (stop === 'ai_review') return finalize();

  // 6. Решение мастера: доработка или закрытие.
  if (rv.verdict === 'rework' && poor) {
    const tr = tv + toMs(r.int(5, 90));
    add('rework', master, 'ai_review', 'rework', tr, { reason: r.pick(REWORK_REASONS), reason_code: 'other' });
    status = 'rework';
    if (stop === 'rework') return finalize();
    t = tr + toMs(r.int(10, 120));
    add('start', assignee, 'rework', 'in_progress', t);
    t += toMs(norm * 60 * r.range(0.3, 0.7));
    doneOff = t;
    add('done', assignee, 'in_progress', 'done', t);
    add('send_to_review', null, 'done', 'ai_review', t + 2000);
    status = 'ai_review';
    tv = t + 2000 + toMs(r.int(8, 40) / 60);
    rv = review(false, false, doneOff);
    add('ai_verdict', null, 'ai_review', 'ai_review', tv, { comment: `${rv.verdict}, ${rv.score}/5` });
    reviews.push({ ...rv, off: tv });
  }

  // Оценка мастера: меняется только с причиной. Бывает при сомнении ИИ, перерасходе, и у проблемного исполнителя.
  const last = reviews[reviews.length - 1];
  const clamp = (x) => Math.min(5, Math.max(1, x));
  let ms = null;
  let mr = null;
  if (last.verdict === 'rework') {
    ms = 4;
    mr = 'Перерасход подтверждён актом списания, работа выполнена полностью, оценка поднята';
  } else if (last.verdict === 'needs_master') {
    ms = clamp(last.score + r.pick([-1, 0, 1]));
    mr = 'ИИ не смог проверить закрытие, оценка поставлена мастером после осмотра';
  } else if (prof.lower && r.chance(prof.lower)) {
    ms = clamp(last.score - r.int(1, 2));
    mr = r.pick(MASTER_LOWER);
  } else if (r.chance(0.04)) {
    const down = r.chance(0.5);
    ms = clamp(last.score + (down ? -1 : 1));
    mr = r.pick(down ? MASTER_LOWER : MASTER_RAISE);
  }
  if (ms === last.score) ms = ms === 5 ? 4 : ms + 1;
  let tc = tv;
  if (ms !== null) {
    tc = tv + toMs(r.int(2, 40));
    add('master_score', master, 'ai_review', 'ai_review', tc, { comment: `${last.score ?? '—'} -> ${ms}`, reason: mr });
    last.master_score = ms;
    last.master_reason = mr;
  }
  t = tc + toMs(r.int(3, 90));
  add('close', master, 'ai_review', 'closed', t);
  closedOff = t;
  status = 'closed';
  return finalize();
}

// ============================================================
// Сценарий генерации: что и когда создаётся
// ============================================================

// Описание и параметры наряда до сборки. Мастер — по смене создания, исполнитель — по шифру и смене.
function makeSpec(o) {
  const seed = Math.floor(rng.next() * 4294967296);
  const shift = shiftOf(o.createdMs);
  const worker = o.worker ?? pickWorker(rng, specialtyFor(o.code, rng), shift, o.excludeLogin);
  const planned = o.type === 'planned';
  let priority = 'planned';
  if (!planned) {
    const x = rng.next();
    priority = x < 0.16 ? 'emergency' : x < 0.41 ? 'high' : 'normal';
  }
  const text = planned ? rng.pick(PLAN_DESC[o.code]) : rng.pick(DESC[o.code]);
  let description = `${o.eq.name}: ${text}`;
  if (o.repeat) description = `${o.eq.name}: повторно — ${text}`;
  if (priority === 'emergency') description += '. Оборудование остановлено';

  // Исход: 3% отмена, 2% отказ с переназначением, 4% очередь, остальное — закрытие.
  const x = rng.next();
  const profile = PROFILES[WORKER_PROFILE[worker.login] ?? 'average'];
  const spec = {
    seed,
    id: rng.uuid(),
    eq: o.eq,
    code: o.code,
    type: o.type,
    priority,
    description,
    worker,
    worker2: null,
    master: o.master ?? (shift === 'A' ? master1 : master2),
    parentId: o.parentId ?? null,
    overuse: !!o.overuse,
    stopAt: o.stopAt ?? null,
    cancel: false,
    reject: false,
    queue: false,
    late: false,
    createdMs: o.createdMs,
  };
  if (!o.stopAt) {
    if (x < 0.03) {
      spec.cancel = true;
      spec.stopAt = rng.pick(['issued', 'accepted', 'in_progress']);
    } else if (x < 0.05) {
      spec.reject = true;
      spec.worker2 = pickWorker(rng, worker.specialty, shift, worker.login);
    } else if (x < 0.09) {
      spec.queue = true;
    }
    spec.late = !spec.cancel && rng.chance(profile.late);
  }
  return spec;
}

// Сборка с учётом «сейчас»: событие не может быть в будущем.
function buildClosedOrder(spec) {
  let created = spec.createdMs;
  let built = buildOrder(spec, created);
  const overshoot = created + built.lastOff - (NOW - 10 * MIN);
  if (overshoot > 0) {
    created -= overshoot;
    built = buildOrder(spec, created);
  }
  return { spec, createdMs: created, ...built };
}

const results = [];

// --- Плановые работы: каждое оборудование раз в ~12 суток, КМД-1750 раз в ~7 суток (закономерность c) ---
const PLANNED_CODES = [['С-01', 3], ['М-04', 2], ['Э-03', 2], ['С-02', 1.5], ['М-05', 1]];
const KMD_PLANNED_CODES = [['М-01', 2], ['М-04', 1], ['С-02', 1.5], ['С-01', 1]];
const plannedTimes = new Map(); // id оборудования -> времена плановых работ (для проверки окна ниже)
const kmdPlanned = [];
for (const eq of equipment) {
  const isKmd = eq.inventory_no === EQ_KMD;
  let daysAgo = isKmd ? rng.int(2, 6) : rng.int(1, 12);
  plannedTimes.set(eq.id, []);
  while (daysAgo <= DAYS) {
    const createdMs = DAY0 - daysAgo * DAY + rng.int(8, 10) * HOUR + rng.int(0, 59) * MIN;
    const code = rng.weighted(isKmd ? KMD_PLANNED_CODES : PLANNED_CODES, (c) => c[1])[0];
    const spec = makeSpec({ eq, code, type: 'planned', createdMs });
    const built = buildClosedOrder(spec);
    results.push(built);
    plannedTimes.get(eq.id).push(built.createdMs);
    if (isKmd) kmdPlanned.push(built);
    daysAgo += isKmd ? rng.int(6, 8) : rng.int(10, 14);
  }
}

// --- Закономерность c: после ППР КМД-1750 в 80% случаев поломка через 1–5 суток ---
const KMD_BREAK_CODES = [['М-02', 3], ['М-01', 2], ['Э-03', 1], ['Г-01', 1], ['С-04', 1.5]];
for (const p of kmdPlanned) {
  if (!rng.chance(0.8)) continue;
  const createdMs = p.createdMs + rng.range(1.2, 4.7) * DAY;
  if (createdMs > DAY0 - 3 * HOUR) continue;
  const code = rng.weighted(KMD_BREAK_CODES, (c) => c[1])[0];
  results.push(buildClosedOrder(makeSpec({ eq: p.spec.eq, code, type: 'unplanned', createdMs })));
}

// --- Фоновые внеплановые наряды, закономерности a и d ---
// Вес оборудования: К-3 втрое чаще (a), КМД-1750 реже: его поломки заложены отдельно (c).
const eqWeight = (e) => (e.inventory_no === EQ_K3 ? 3 : e.inventory_no === EQ_KMD ? 0.3 : 1);
// Доля ночных нарядов: на обогащении ночью вдвое больше, чем днём (d); на остальных участках ночью меньше.
const nightShare = (e) => (sectionNameById.get(e.section_id) === SECTION_ENRICH ? 0.67 : 0.38);
const inWindowAfterPlanned = (eq, ms) => plannedTimes.get(eq.id).some((p) => ms - p > 0 && ms - p < 5.2 * DAY);

for (let i = 0; i < N_UNPLANNED; i++) {
  const eq = rng.weighted(equipment, eqWeight);
  const shift = rng.chance(nightShare(eq)) ? 'B' : 'A';
  // Фоновые поломки реже попадают в 5 суток после ППР, чтобы закономерность c была заметна.
  let createdMs = randomTime(shift);
  for (let tries = 0; tries < 8 && inWindowAfterPlanned(eq, createdMs) && !rng.chance(0.15); tries++) createdMs = randomTime(shift);

  const section = sectionNameById.get(eq.section_id);
  let code;
  let overuse = false;
  if (eq.inventory_no === EQ_K3 && rng.chance(0.7)) code = 'М-02'; // a: подшипник
  else if (section === SECTION_ENRICH && shift === 'B' && rng.chance(0.65)) {
    code = rng.pick(['Г-01', 'С-01', 'С-02']); // d: масло
    overuse = true;
  } else code = rng.weighted(TYPE_CODES[eq.type] ?? DEFAULT_CODES, (c) => c[1])[0];
  results.push(buildClosedOrder(makeSpec({ eq, code, type: 'unplanned', createdMs, overuse })));
}

// --- Закономерность b: повторные неисправности после ремонтов w07 (в течение 7 суток, тот же шифр) ---
const w07Orders = results.filter((x) => x.assigneeLogin === PROBLEM_WORKER && x.order.status === 'closed');
for (const x of w07Orders) {
  if (!rng.chance(REPEAT_P)) continue;
  const createdMs = Date.parse(x.order.done_at) + rng.range(1, 6) * DAY;
  if (createdMs > DAY0 - 3 * HOUR) continue;
  results.push(
    buildClosedOrder(
      makeSpec({ eq: x.spec.eq, code: x.spec.code, type: 'unplanned', createdMs, parentId: x.spec.id, repeat: true, excludeLogin: PROBLEM_WORKER }),
    ),
  );
}

// --- Открытые наряды: чтобы доска мастера не была пустой (всё выдаёт master1) ---
const OPEN = [
  ['in_progress', 'unplanned', 'emergency'], // аварийный наверху
  ['in_progress', 'unplanned'],
  ['in_progress', 'unplanned'],
  ['issued', 'unplanned'],
  ['issued', 'planned'],
  ['issued', 'unplanned'],
  ['accepted', 'unplanned'],
  ['accepted', 'planned'],
  ['paused', 'unplanned'],
  ['paused', 'unplanned'],
  ['ai_review', 'unplanned'],
  ['ai_review', 'planned'],
  ['rework', 'unplanned'],
];
const openSection = ['Участок дробления', 'Участок обогащения', 'Участок сушки и упаковки'];
OPEN.forEach(([stopAt, type, forcedPriority], i) => {
  const eq = rng.pick(equipment.filter((e) => openSection.includes(sectionNameById.get(e.section_id))));
  const code = type === 'planned' ? rng.weighted(PLANNED_CODES, (c) => c[1])[0] : rng.weighted(TYPE_CODES[eq.type] ?? DEFAULT_CODES, (c) => c[1])[0];
  const spec = makeSpec({ eq, code, type, createdMs: NOW - 30 * MIN, stopAt, master: master1 });
  if (forcedPriority) spec.priority = forcedPriority;
  const first = buildOrder(spec, 0);
  // Открытые наряды стоят «давно»: у выданных и принятых срок часто уже прошёл.
  const extra = toMs(stopAt === 'issued' || stopAt === 'accepted' ? rng.int(60, 300) : rng.int(5, 120));
  const createdMs = NOW - first.lastOff - extra;
  spec.worker = pickWorker(rng, specialtyFor(code, rng), shiftOf(createdMs));
  results.push({ spec, createdMs, ...buildOrder(spec, createdMs) });
});

// Хронологический порядок: по нему вставляем, тогда number идёт по времени.
results.sort((a, b) => a.createdMs - b.createdMs);

// ============================================================
// Вставка в базу
// ============================================================

console.log(`Шаг 3–6. Вставка: ${results.length} нарядов...`);
const orders = results.map((x) => x.order);
const events = results.flatMap((x) => [...x.events].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
const usages = results.flatMap((x) => x.usages);
const reviews = results.flatMap((x) => x.reviews);

await insertBatches('work_orders', orders);
await insertBatches('work_order_events', events);
await insertBatches('material_usages', usages);
await insertBatches('ai_reviews', reviews);

// ============================================================
// Итоги и проверка закономерностей (считается по тем же данным, что ушли в базу)
// ============================================================

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : '—');
const round1 = (x) => Math.round(x * 10) / 10;
const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const eqName = new Map(equipment.map((e) => [e.id, e.name]));
const eqInv = new Map(equipment.map((e) => [e.id, e.inventory_no]));
const loginOf = (id) => employeeById.get(id)?.login;
const done = (o) => (o.done_at ? Date.parse(o.done_at) : null);

console.log('\n=== Итоги (по базе) ===');
for (const table of ['sections', 'equipment', 'employees', 'fault_codes', 'materials', 'work_orders', 'work_order_events', 'material_usages', 'ai_reviews', 'photos', 'requests']) {
  console.log(`${table.padEnd(18)} ${await countRows(table)}`);
}
console.log(`сотрудники: мастеров ${employees.filter((e) => e.role === 'master').length}, исполнителей ${workers.length}, руководителей ${employees.filter((e) => e.role === 'lead').length}`);

console.log('\nНаряды по статусам:');
const byStatus = {};
for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
console.log(Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', '));
const planned = orders.filter((o) => o.type === 'planned').length;
const emergency = orders.filter((o) => o.priority === 'emergency').length;
console.log(`плановых ${planned} (${pct(planned, orders.length)}), внеплановых ${orders.length - planned}, аварийных ${emergency} (${pct(emergency, orders.length)})`);
const closed = orders.filter((o) => o.status === 'closed');
const overdue = closed.filter((o) => done(o) > Date.parse(o.due_at));
console.log(`закрытых ${closed.length}, из них с просрочкой ${overdue.length} (${pct(overdue.length, closed.length)})`);
const events2 = new Map();
for (const e of events) events2.set(e.order_id, [...(events2.get(e.order_id) ?? []), e.action]);
const rejectReassigned = orders.filter((o) => events2.get(o.id).includes('reassign')).length;
console.log(`с отказом и переназначением ${rejectReassigned}, на доработку отправлялись ${orders.filter((o) => events2.get(o.id).includes('rework')).length}`);

// a) конвейеры
console.log('\n[a] Внеплановые наряды по конвейерам (за всё время):');
const conveyors = equipment.filter((e) => e.type === 'конвейер');
const convCount = conveyors.map((e) => ({ name: e.name, n: orders.filter((o) => o.equipment_id === e.id && o.type === 'unplanned').length }));
console.log(convCount.map((c) => `${c.name}=${c.n}`).join(', '));
const k3 = convCount.find((c) => c.name === 'Конвейер К-3').n;
const others = convCount.filter((c) => c.name !== 'Конвейер К-3');
console.log(`К-3: ${k3}, среднее по остальным: ${round1(avg(others.map((c) => c.n)))}, отношение ${round1(k3 / avg(others.map((c) => c.n)))}x`);
const k3Id = eqByInv.get(EQ_K3).id;
const k3Orders = orders.filter((o) => o.equipment_id === k3Id && o.type === 'unplanned');
console.log(`К-3, шифр М-02: ${k3Orders.filter((o) => o.fault_code === 'М-02').length} из ${k3Orders.length}`);

// b) исполнители: доработки, повторы, оценка
console.log('\n[b] Исполнители (наряды / доработки / повторы за 7 суток / средняя оценка / в срок):');
const lastReview = new Map();
for (const v of reviews) lastReview.set(v.order_id, v); // ai_reviews идут по порядку наряда, последняя запись — финальная
const unplannedOrders = orders.filter((o) => o.type === 'unplanned');
const workerStats = workers.map((w) => {
  const mine = orders.filter((o) => o.assignee_id === w.id && o.status === 'closed');
  const reworks = mine.filter((o) => events2.get(o.id).includes('rework')).length;
  const repeats = mine.filter((o) =>
    unplannedOrders.some(
      (u) => u.id !== o.id && u.equipment_id === o.equipment_id && u.fault_code === o.fault_code && Date.parse(u.created_at) > done(o) && Date.parse(u.created_at) <= done(o) + 7 * DAY,
    ),
  ).length;
  const scores = mine.map((o) => lastReview.get(o.id)).filter(Boolean).map((v) => v.master_score ?? v.score);
  const onTime = mine.filter((o) => done(o) <= Date.parse(o.due_at)).length;
  return { login: w.login, n: mine.length, reworks, repeats, score: avg(scores), onTime };
});
for (const s of workerStats) {
  console.log(`${s.login.padEnd(8)} ${String(s.n).padStart(3)} / ${pct(s.reworks, s.n).padStart(4)} / ${pct(s.repeats, s.n).padStart(4)} / ${s.score.toFixed(2)} / ${pct(s.onTime, s.n)}`);
}
const w07s = workerStats.find((s) => s.login === PROBLEM_WORKER);
const rest07 = workerStats.filter((s) => s.login !== PROBLEM_WORKER);
console.log(
  `w07: доработки ${pct(w07s.reworks, w07s.n)}, повторы ${pct(w07s.repeats, w07s.n)}, оценка ${w07s.score.toFixed(2)}; остальные: доработки ${pct(rest07.reduce((s, x) => s + x.reworks, 0), rest07.reduce((s, x) => s + x.n, 0))}, повторы ${pct(rest07.reduce((s, x) => s + x.repeats, 0), rest07.reduce((s, x) => s + x.n, 0))}`,
);

// c) КМД-1750
console.log('\n[c] Поломки после планового ремонта (внеплановый наряд на том же оборудовании в течение 5 суток после планового):');
const followed = (eqIds) => {
  const plan = orders.filter((o) => o.type === 'planned' && eqIds.has(o.equipment_id));
  const hit = plan.filter((p) => unplannedOrders.some((u) => u.equipment_id === p.equipment_id && Date.parse(u.created_at) > Date.parse(p.created_at) && Date.parse(u.created_at) <= Date.parse(p.created_at) + 5 * DAY));
  return { plan: plan.length, hit: hit.length };
};
const kmd = followed(new Set([eqByInv.get(EQ_KMD).id]));
const restEq = followed(new Set(equipment.filter((e) => e.inventory_no !== EQ_KMD).map((e) => e.id)));
console.log(`КМД-1750: плановых ${kmd.plan}, после них поломка в 5 суток: ${kmd.hit} (${pct(kmd.hit, kmd.plan)})`);
console.log(`остальное оборудование: плановых ${restEq.plan}, после них поломка в 5 суток: ${restEq.hit} (${pct(restEq.hit, restEq.plan)})`);

// d) ночь на обогащении
console.log('\n[d] Внеплановые наряды по сменам:');
const sectionOf = (o) => sectionNameById.get(o.section_id);
const countShift = (pred, sh) => unplannedOrders.filter((o) => pred(o) && shiftOf(Date.parse(o.created_at)) === sh).length;
const enrichDay = countShift((o) => sectionOf(o) === SECTION_ENRICH, 'A');
const enrichNight = countShift((o) => sectionOf(o) === SECTION_ENRICH, 'B');
const otherDay = countShift((o) => sectionOf(o) !== SECTION_ENRICH, 'A');
const otherNight = countShift((o) => sectionOf(o) !== SECTION_ENRICH, 'B');
console.log(`Обогащение: день ${enrichDay}, ночь ${enrichNight}, ночь/день = ${round1(enrichNight / enrichDay)}`);
console.log(`Остальные участки: день ${otherDay}, ночь ${otherNight}, ночь/день = ${round1(otherNight / otherDay)}`);
const orderById = new Map(orders.map((o) => [o.id, o]));
const matOf = new Map(materials.map((m) => [m.id, m]));
const overuseRows = usages.filter((u) => u.qty > 2 * matOf.get(u.material_id).typical_qty);
const overuseBy = { 'обогащение, ночь': 0, 'обогащение, день': 0, 'остальные участки': 0 };
for (const u of overuseRows) {
  const o = orderById.get(u.order_id);
  if (sectionOf(o) !== SECTION_ENRICH) overuseBy['остальные участки']++;
  else overuseBy[shiftOf(Date.parse(o.created_at)) === 'B' ? 'обогащение, ночь' : 'обогащение, день']++;
}
console.log(`Списания с расходом больше 2x обычного: ${Object.entries(overuseBy).map(([k, v]) => `${k}=${v}`).join(', ')}`);

// Проверка в базе: номера идут по времени, без пропусков.
let prev = null;
let ordered = true;
let total = 0;
for (let offset = 0; ; offset += 1000) {
  const { data } = await rest('GET', `/work_orders?select=number,created_at&order=number.asc&limit=1000&offset=${offset}`);
  for (const row of data) {
    total++;
    if (prev && (row.number !== prev.number + 1 || row.created_at < prev.created_at)) ordered = false;
    prev = row;
  }
  if (data.length < 1000) break;
}
console.log(`\nПроверка в базе: ${total} нарядов, номера подряд и по времени: ${ordered ? 'да' : 'НЕТ'}`);
if (!ordered) process.exit(1);
console.log('Готово.');
