// Вопросы к Laya. Модель обучена на английском, поэтому вопросы и варианты по-английски,
// а само описание наряда остаётся на русском — так, как его пишет мастер.
// Ключи вариантов совпадают с кодами в базе: категории шифров М/Э/Г/П/С, приоритеты, специальности.

export const QUESTIONS = {
  category: {
    type: "choice",
    instructions: "Which fault category does this industrial equipment repair request belong to?",
    criteria: {
      М: "mechanical: bearings, belts, conveyor belt, gears, wear, liners, fasteners, shafts, seals, vibration, noise",
      Э: "electrical: electric motor, cable, power, protection tripped, sensor, switchboard, sparks, wiring",
      Г: "hydraulic: oil leak, hydraulic pump, high-pressure hose, hydraulic pressure drop",
      П: "pneumatic: compressed air leak, pneumatic cylinder, air line blockage",
      С: "lubrication: lack of grease or oil, contaminated lubricant, lubrication system, overheating from poor lubrication",
    },
  },
  priority: {
    type: "choice",
    instructions: "How urgent is this repair request at a mining and processing plant?",
    criteria: {
      emergency: "equipment stopped or unsafe: fire, sparks, smoke, injury risk, major leak, production line down",
      high: "equipment works but is degrading fast: strong vibration, overheating, leak growing",
      normal: "minor defect, can wait for its turn in the queue",
      planned: "scheduled maintenance, inspection, planned lubrication or replacement",
    },
  },
  specialty: {
    type: "choice",
    instructions: "Which specialist should do this repair?",
    criteria: {
      слесарь: "mechanic / fitter: mechanical, hydraulic, pneumatic and lubrication work",
      электрик: "electrician: motors, cables, power, sensors, switchboards",
      сварщик: "welder: cracks, broken metal structures, welding and cutting",
    },
  },
};
