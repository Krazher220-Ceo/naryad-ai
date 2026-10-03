import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export default async function MasterRatingPage({ searchParams }: PageProps<"/master/rating">) {
  const employee = await requireRole("master");
  const { days } = await searchParams;
  return (
    <RatingScreen fullName={employee.fullName} roleLabel={t("roles.master")} basePath="/master" days={parseDays(days)} />
  );
}
