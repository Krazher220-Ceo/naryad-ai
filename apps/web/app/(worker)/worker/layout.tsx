import { requireRole } from "@/lib/auth/session";
import { OfflineSync } from "@/lib/offline/OfflineSync";

export default async function WorkerLayout({ children }: LayoutProps<"/worker">) {
  await requireRole("worker");
  return (
    <>
      <OfflineSync />
      {children}
    </>
  );
}
