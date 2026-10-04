import { InlineNotice } from "@/components/ui";
import { QrScanner } from "@/components/scan/QrScanner";
import { getT } from "@/lib/i18n-server";

// Сканер исполнителя: QR на машине открывает свой наряд на ней или историю ремонтов.
export default async function WorkerScanPage({ searchParams }: PageProps<"/worker/scan">) {
  const t = await getT();
  const { notFound } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
      <h1 className="hidden text-3xl font-semibold text-ink lg:block">{t("scan.title")}</h1>
      {notFound && <InlineNotice tone="warning">{t("scan.notFound")}</InlineNotice>}
      <QrScanner />
    </main>
  );
}
