// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { headers } from "next/headers";
import Link from "next/link";
import { QrPlates } from "@/components/equipment/QrPlates";
import { qrModules } from "@/components/equipment/qr";
import type { PlateData } from "@/components/equipment/plate";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

export default async function EquipmentQrPage() {
  const t = await getT();
  await requireRole("master");

  // Адрес сайта берём из запроса: работает и на localhost, и на Vercel
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, name, inventory_no, qr_code, section:section_id ( name )")
    .order("inventory_no");
  if (error) throw error;

  const plates: PlateData[] = (data ?? []).map((e) => {
    const qr = qrModules(`${origin}/q/${e.qr_code}`);
    return {
      id: e.id,
      name: e.name,
      inventoryNo: e.inventory_no,
      sectionName: e.section?.name ?? "",
      shortUrl: `${host}/q/${e.qr_code}`,
      qrSize: qr.size,
      qrPath: qr.path,
    };
  });

  // Логотип берём из файла и кладём в табличку без внешнего <svg>
  const logoFile = await readFile(join(process.cwd(), "public/brand/km-logo.svg"), "utf8");
  const logoInner = logoFile.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

  return (
    <div className="flex flex-1 flex-col bg-canvas print:bg-white">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 md:max-w-4xl xl:max-w-6xl print:max-w-none print:p-0">
        <div className="flex flex-col gap-3 print:hidden">
          <Link href="/master" className="text-base font-semibold text-ink underline">
            {t("equipmentQr.back")}
          </Link>
          <h1 className="text-2xl font-bold text-ink">{t("equipmentQr.title")}</h1>
          <p className="text-base text-ink-muted">{t("equipmentQr.hint")}</p>
        </div>
        <QrPlates
          plates={plates}
          logoInner={logoInner}
          labels={{
            app: t("app.name"),
            company: t("shell.company"),
            cta: t("equipmentQr.cta"),
            inventory: t("equipmentQr.inventory"),
          }}
        />
      </main>
    </div>
  );
}
