import { QrScanner } from "@/components/scan/QrScanner";
import { getT } from "@/lib/i18n-server";

// Сканер оператора: QR на машине или на входе в цех ведёт к заявке о поломке.
export default async function OperatorScanPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
      <h1 className="hidden text-3xl font-semibold text-ink lg:block">{t("scan.title")}</h1>
      <QrScanner />
    </main>
  );
}
