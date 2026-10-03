import { cx } from "./cx";

// Карточка-контейнер. tone="emergency" — красная рамка для аварийного наряда.
export function Card({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "emergency";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-surface p-4",
        tone === "emergency" ? "border-2 border-danger" : "border border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}
