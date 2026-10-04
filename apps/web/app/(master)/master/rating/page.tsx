import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";

export default async function MasterRatingPage({ searchParams }: PageProps<"/master/rating">) {
  const t = await getT();
  const employee = await requireRole("master");
  const { days } = await searchParams;
  return (
    <RatingScreen fullName={employee.fullName} roleLabel={t("roles.master")} basePath="/master" days={parseDays(days)} />
  );
}
