import Link from "next/link";
import { cx } from "./cx";
import { IconChevronRight } from "./icons";

type ListItemProps = {
  title: string;
  subtitle?: string;
  // Бейджи и метки под заголовком: статус, приоритет, просрочка.
  badges?: React.ReactNode;
  // Справа от заголовка: срок или номер наряда.
  meta?: React.ReactNode;
  tone?: "default" | "emergency";
  // Слева: значок, например тип оборудования.
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
};

// Строка списка нарядов или исполнителей. Высота от 72 px, вся строка — одна цель касания.
export function ListItem({ title, subtitle, badges, meta, tone = "default", icon, href, onClick }: ListItemProps) {
  const clickable = Boolean(href || onClick);
  const className = cx(
    "flex min-h-18 w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left",
    tone === "emergency" ? "border-2 border-l-8 border-danger" : "border border-line",
    clickable && "hover:bg-canvas active:bg-line",
  );

  const body = (
    <>
      {icon && <span className="flex size-10 shrink-0 items-center justify-center self-start rounded-xl bg-canvas text-ink">{icon}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg font-semibold leading-snug text-ink">{title}</span>
          {meta && <span className="shrink-0 text-base font-semibold text-ink">{meta}</span>}
        </div>
        {subtitle && <span className="text-base text-ink-muted">{subtitle}</span>}
        {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
      </div>
      {clickable && <IconChevronRight className="size-6 shrink-0 text-ink-muted" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}
