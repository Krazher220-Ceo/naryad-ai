// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
// Инлайн-иконки. Только те, что нужны компонентам. Размер задаётся классом.

type IconProps = { className?: string };

function Svg({ className = "size-6", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}

export function IconX(p: IconProps) {
  return <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

export function IconPlus(p: IconProps) {
  return <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function IconMinus(p: IconProps) {
  return <Svg {...p}><path d="M5 12h14" /></Svg>;
}

export function IconChevronRight(p: IconProps) {
  return <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
}

export function IconChevronLeft(p: IconProps) {
  return <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
}

export function IconChevronDown(p: IconProps) {
  return <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
}

export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function IconImage(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </Svg>
  );
}

export function IconWifiOff(p: IconProps) {
  return <Svg {...p}><path d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 015-2.6M14 10a10 10 0 015 2.5M2 8.8a15 15 0 015-2.6M12 20h.01" /></Svg>;
}

export function IconInbox(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 13l3-8h12l3 8v6H3z" />
      <path d="M3 13h5l1 3h6l1-3h5" />
    </Svg>
  );
}

export function IconMic(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
    </Svg>
  );
}

export function IconSpinner({ className = "size-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`motion-safe:animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.3} strokeWidth={3} />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

// Иконки каркаса: нижнее меню, колокольчик, профиль.
export function IconBell(p: IconProps) {
  return <Svg {...p}><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" /></Svg>;
}

export function IconScan(p: IconProps) {
  return <Svg {...p}><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M8 12h8" /></Svg>;
}

export function IconUser(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Svg>;
}

export function IconClipboard(p: IconProps) {
  return <Svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></Svg>;
}

export function IconChart(p: IconProps) {
  return <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></Svg>;
}

export function IconChat(p: IconProps) {
  return <Svg {...p}><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z" /></Svg>;
}

export function IconWarning(p: IconProps) {
  return <Svg {...p}><path d="M12 3l10 18H2zM12 10v4M12 17.5v.01" /></Svg>;
}
