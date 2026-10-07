// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
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
        "fixed right-0 bottom-0 left-0 z-30 border-t lg:left-72 border-line bg-surface/95 px-4 pt-3 backdrop-blur-sm",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2">{children}</div>
    </div>
  );
}
