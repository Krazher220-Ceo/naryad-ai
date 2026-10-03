import { requireRole } from "@/lib/auth/session";

export default async function LeadLayout({ children }: LayoutProps<"/lead">) {
  await requireRole("lead");
  return <>{children}</>;
}
