import Link from "next/link";
import { Card, IconCheck, IconWifiOff } from "@/components/ui";
import { getT } from "@/lib/i18n-server";

// «Заявка отправлена»: номер, что дальше, кнопка к «Мои заявки».
export default async function SentPage({ searchParams }: PageProps<"/operator/sent">) {
  const t = await getT();
  const { n, place, queued } = await searchParams;
  const number = typeof n === "string" && /^\d+$/.test(n) ? n : null;
  const isQueued = queued === "1" || !number;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6 lg:py-10">
      <Card className="flex flex-col items-center gap-3 text-center">
        <span className={isQueued ? "flex size-16 items-center justify-center rounded-full bg-line text-ink" : "flex size-16 items-center justify-center rounded-full bg-success-soft text-success"}>
          {isQueued ? <IconWifiOff className="size-8" /> : <IconCheck className="size-8" />}
        </span>
        <h1 className="text-2xl font-semibold text-ink">
          {isQueued ? t("sent.queuedTitle") : t("sent.title").replace("{n}", number ?? "")}
        </h1>
        {typeof place === "string" && !isQueued && <p className="text-lg font-semibold text-ink">{place}</p>}
        <p className="text-base text-ink-muted">{isQueued ? t("sent.queuedText") : t("sent.text")}</p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">{t("sent.next")}</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-ink">
          <li>{t("sent.step1")}</li>
          <li>{t("sent.step2")}</li>
          <li>{t("sent.step3")}</li>
        </ol>
      </Card>

      <Link href="/operator" className="flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-lg font-semibold text-white hover:bg-brand-hover">
        {t("sent.myRequests")}
      </Link>
      <Link href="/operator/scan" className="flex min-h-touch items-center justify-center rounded-xl border-2 border-ink bg-surface px-5 text-lg font-semibold text-ink hover:bg-canvas">
        {t("sent.another")}
      </Link>
    </main>
  );
}
