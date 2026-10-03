// Заглушки: по одной пиктограмме на тип оборудования.
// Позже каждую машину можно заменить своим SVG.
// Стиль как у Lucide: сетка 24x24, обводка currentColor.

const ICONS = {
  crusher: '<path d="M3 4h18l-6 7H9z"/><path d="M9 11v4l-2 5M15 11v4l2 5"/>',
  conveyor:
    '<rect x="2" y="9" width="20" height="6" rx="3"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><path d="M6 18h.01M12 18h.01M18 18h.01"/>',
  mill: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5"/><circle cx="14" cy="14" r="2"/><circle cx="14" cy="8.5" r="1"/>',
  pump: '<circle cx="11" cy="12" r="6"/><path d="M11 9v3l2 1.5"/><path d="M17 12h5M3 18h8M7 18v-3"/>',
  screen: '<path d="M3 8l18-3M3 13l18-3M3 18l18-3"/><path d="M5 20v-2M19 16v4"/>',
  feeder: '<path d="M4 4h16l-4 7H8z"/><path d="M8 11v3h8v-3"/><path d="M4 18h16M7 21h10"/>',
  dryer:
    '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M8 8v8M16 8v8"/><path d="M8 3c-1 1 1 2 0 3M12 3c-1 1 1 2 0 3M16 3c-1 1 1 2 0 3"/>',
  compressor:
    '<rect x="3" y="9" width="14" height="8" rx="3"/><path d="M17 13h4M7 9V6h6v3M6 20h10"/>',
  flotation:
    '<path d="M3 10h18v9H3z"/><path d="M8 10V6M16 10V6M6 14h.01M10 15h.01M14 14h.01M18 15h.01M12 4h.01M18 3h.01"/>',
  machine:
    '<path d="M3 20h18"/><path d="M5 20V9h8v11"/><path d="M13 12h6v8"/><path d="M8 9V5h5"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 4-1 6M14 12c4 0 7 1 7 4 0 2-4 2-6-1M12 14c0 4-1 7-4 7-2 0-2-4 1-6M10 12c-4 0-7-1-7-4 0-2 4-2 6 1"/>',
  thickener: '<path d="M3 8l9 2 9-2"/><path d="M4 8l4 11h8l4-11"/><path d="M12 3v7"/>',
  hydrocyclone: '<path d="M6 3h12v5l-4 2v6l-2 5-2-5v-6L6 8z"/><path d="M18 5h3"/>',
  separator:
    '<rect x="4" y="5" width="16" height="8" rx="2"/><path d="M8 13l-2 7h12l-2-7"/><path d="M9 9h6"/>',
  motor:
    '<rect x="5" y="7" width="12" height="10" rx="2"/><path d="M17 12h4M3 10v4M8 7v10M11 7v10M14 7v10"/>',
  gearbox:
    '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><circle cx="15.5" cy="12" r="1.5"/>',
  crane: '<path d="M4 21V7l3-3h14"/><path d="M4 7h8M14 4v8"/><path d="M14 12v4"/><rect x="12" y="16" width="4" height="4" rx="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
} as const;

export type EquipmentIconKey = keyof typeof ICONS;

// Правила идут по порядку, первое совпадение побеждает.
// «Сушильный барабан» должен попасть в сушилку, а не в мельницу, поэтому он выше.
const RULES: [string, EquipmentIconKey][] = [
  ["дробил", "crusher"],
  ["конвейер", "conveyor"],
  ["транспортер", "conveyor"],
  ["сушил", "dryer"],
  ["сушиль", "dryer"],
  ["мельниц", "mill"],
  ["насос", "pump"],
  ["грохот", "screen"],
  ["питател", "feeder"],
  ["компрессор", "compressor"],
  ["флотомашин", "flotation"],
  ["станок", "machine"],
  ["вентилятор", "fan"],
  ["сгуститель", "thickener"],
  ["гидроциклон", "hydrocyclone"],
  ["сепаратор", "separator"],
  ["двигател", "motor"],
  ["редуктор", "gearbox"],
  ["кран", "crane"],
];

export function iconKeyForType(type: string): EquipmentIconKey {
  const lower = type.toLowerCase();
  return RULES.find(([word]) => lower.includes(word))?.[1] ?? "gear";
}

// Внутренность SVG (пути) для вставки в другой SVG, например в QR-код.
export function equipmentIconPaths(type: string): string {
  return ICONS[iconKeyForType(type)];
}

// Готовый SVG-текст с размерами и цветом.
export function equipmentIconMarkup(type: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${equipmentIconPaths(type)}</svg>`
  );
}

export function EquipmentIcon({ type, className }: { type: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      // Пути написаны нами выше, пользовательских данных тут нет
      dangerouslySetInnerHTML={{ __html: equipmentIconPaths(type) }}
    />
  );
}
