import { RatingScreen, parseDays } from "@/components/reports/RatingScreen";
import { requireRole } from "@/lib/auth/session";

export default async function LeadRatingPage({ searchParams }: PageProps<"/lead/rating">) {
  await requireRole("lead");
  const { days } = await searchParams;
  return (
    <RatingScreen basePath="/lead" days={parseDays(days)} />
  );
}
