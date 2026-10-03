import { requireRole } from "@/lib/auth/session";

export default async function MasterLayout({ children }: LayoutProps<"/master">) {
  await requireRole("master");
  return <>{children}</>;
}
