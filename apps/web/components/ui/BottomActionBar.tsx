import { cx } from "./cx";

// Панель главного действия внизу экрана, в зоне большого пальца.
// Странице под ней нужен нижний отступ pb-36, чтобы панель не закрывала контент.
export function BottomActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur-sm",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2">{children}</div>
    </div>
  );
}
