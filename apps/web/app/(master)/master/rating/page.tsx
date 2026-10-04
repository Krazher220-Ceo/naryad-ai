import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";

export default async function MasterRatingPage({ searchParams }: PageProps<"/master/rating">) {
  await requireRole("master");
  const { days } = await searchParams;
  return (
    <RatingScreen basePath="/master" days={parseDays(days)} />
  );
}
