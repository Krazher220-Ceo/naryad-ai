import { t } from "@/lib/i18n";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconAlert, IconInbox } from "./icons";

// Пусто: что здесь будет и что делать дальше.
export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface p-6 text-center">
      <span className="text-ink-muted">{icon ?? <IconInbox className="size-10" />}</span>
      <p className="text-xl font-bold text-ink">{title}</p>
      <p className="max-w-sm text-base text-ink-muted">{text}</p>
      {action}
    </div>
  );
}

// Ошибка загрузки: что случилось и кнопка «Повторить».
export function ErrorState({
  title = t("ui.error.title"),
  text = t("ui.error.text"),
  onRetry,
}: {
  title?: string;
  text?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border-2 border-danger bg-danger-soft p-6 text-center">
      <IconAlert className="size-10 text-danger" />
      <p className="text-xl font-bold text-ink">{title}</p>
      <p className="max-w-sm text-base text-ink">{text}</p>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry}>
          {t("ui.action.retry")}
        </Button>
      )}
    </div>
  );
}

// Заглушка на время загрузки. Размер задаётся классом: <Skeleton className="h-18" />.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("rounded-2xl bg-line motion-safe:animate-pulse", className ?? "h-6 w-full")}
    />
  );
}
