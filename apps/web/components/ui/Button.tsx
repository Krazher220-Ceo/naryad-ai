// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { cx } from "./cx";
import { IconSpinner } from "./icons";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "lg" | "md";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-black",
  secondary: "border-2 border-ink bg-surface text-ink hover:bg-canvas active:bg-line",
  danger: "bg-danger text-white hover:bg-danger-hover active:bg-danger-hover",
  ghost: "bg-transparent text-ink underline-offset-4 hover:underline active:bg-line",
};

// lg — 56 px, главное действие. md — 48 px, вторичное.
const sizeClass: Record<Size, string> = {
  lg: "min-h-touch px-5 text-lg",
  md: "min-h-touch-sm px-4 text-base",
};

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-line disabled:text-ink-muted disabled:no-underline",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <IconSpinner className="size-6" /> : icon}
      <span>{children}</span>
    </button>
  );
}
