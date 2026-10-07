# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# Вопросы к Laya. Ключи вариантов совпадают с кодами в базе: категории шифров М/Э/Г/П/С,
# приоритеты и специальности. Описание наряда передаётся по-русски (модель laya-multilingual),
# а сами вопросы — по-английски: на тесте из 20 описаний так точнее (см. docs/laya-eval.md).

QUESTIONS = {
 "category": {"type":"choice","instructions":"Which fault category does this industrial equipment repair request belong to?",
  "criteria":{"М":"mechanical: bearings, belts, conveyor belt, gears, wear, liners, fasteners, shafts, seals, vibration, noise, cracks",
   "Э":"electrical: electric motor, cable, power supply, protection tripped, sensor, switchboard, sparks",
   "Г":"hydraulic: oil leak, hydraulic pump, high-pressure hose, hydraulic pressure drop",
   "П":"pneumatic: compressed air leak, pneumatic cylinder, air line blockage",
   "С":"lubrication: lack of grease, contaminated oil, oil change, lubrication system, overheating from poor lubrication"}},
 "priority": {"type":"choice","instructions":"How urgent is this repair request at a mining plant?",
  "criteria":{"emergency":"equipment stopped or unsafe: sparks, smoke, injury risk, major leak, line down",
   "high":"still running but degrading fast: strong vibration, overheating, growing leak",
   "normal":"minor defect, can wait in the queue","planned":"scheduled maintenance, inspection, planned lubrication or replacement"}},
 "specialty": {"type":"choice","instructions":"Which specialist should do this repair?",
  "criteria":{"слесарь":"mechanic: mechanical, hydraulic, pneumatic and lubrication work",
   "электрик":"electrician: motors, cables, power, sensors, switchboards","сварщик":"welder: cracks, broken metal structures, welding"}}}
