"use client";

import { useLinkStatus } from "next/link";
import { IconSpinner } from "@/components/ui";

// Значок внутри ссылки: пока сервер готовит экран, вместо значка крутится колесо.
// Так видно, что нажатие сработало, даже при медленной связи.
export function LinkIcon({
  icon: Icon,
  className,
}: {
  icon: (p: { className?: string }) => React.ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return pending ? <IconSpinner className={className} /> : <Icon className={className} />;
}
