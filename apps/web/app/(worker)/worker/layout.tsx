import { requireRole } from "@/lib/auth/session";

export default async function WorkerLayout({ children }: LayoutProps<"/worker">) {
  await requireRole("worker");
  return <>{children}</>;
}
