import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export default async function LeadRatingPage({ searchParams }: PageProps<"/lead/rating">) {
  const employee = await requireRole("lead");
  const { days } = await searchParams;
  return (
    <RatingScreen fullName={employee.fullName} roleLabel={t("roles.lead")} basePath="/lead" days={parseDays(days)} />
  );
}
