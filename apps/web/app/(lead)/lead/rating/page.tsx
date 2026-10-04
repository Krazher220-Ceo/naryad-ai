import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function LeadRatingPage({ searchParams }: PageProps<"/lead/rating">) {
  const t = await getT();
  const employee = await requireRole("lead");
  const { days } = await searchParams;
  return (
    <RatingScreen fullName={employee.fullName} roleLabel={t("roles.lead")} basePath="/lead" days={parseDays(days)} />
  );
}
