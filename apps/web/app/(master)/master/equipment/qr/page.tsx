import { headers } from "next/headers";
import Link from "next/link";
import { EquipmentIcon } from "@/components/equipment/EquipmentIcon";
import { PrintButton } from "@/components/equipment/PrintButton";
import { equipmentQrSvg } from "@/components/equipment/qr";
import { EmptyState } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

type Sticker = { id: string; name: string; inventoryNo: string; type: string; sectionName: string; svg: string };

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
    .select("id, name, inventory_no, type, qr_code, section:section_id ( name )")
    .order("inventory_no");
  if (error) throw error;

  const stickers: Sticker[] = await Promise.all(
    (data ?? []).map(async (e) => ({
      id: e.id,
      name: e.name,
      inventoryNo: e.inventory_no,
      type: e.type ?? "",
      sectionName: e.section?.name ?? "",
      svg: await equipmentQrSvg({ url: `${origin}/q/${e.qr_code}`, type: e.type ?? "", size: 160 }),
    })),
  );

  // Группы по участкам, в порядке появления
  const groups = new Map<string, Sticker[]>();
  for (const s of stickers) groups.set(s.sectionName, [...(groups.get(s.sectionName) ?? []), s]);

  return (
    <div className="flex flex-1 flex-col bg-canvas print:bg-white">
      <div className="print:hidden">
      </div>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 lg:max-w-6xl print:max-w-none print:p-0">
        <div className="flex flex-col gap-3 print:hidden">
          <Link href="/master" className="text-base font-semibold text-ink underline">
            {t("equipmentQr.back")}
          </Link>
          <h1 className="text-2xl font-bold text-ink">{t("equipmentQr.title")}</h1>
          <p className="text-base text-ink-muted">{t("equipmentQr.hint")}</p>
          <div className="lg:max-w-xs">
            <PrintButton />
          </div>
        </div>

        {stickers.length === 0 ? (
          <EmptyState title={t("equipmentQr.emptyTitle")} text={t("equipmentQr.emptyText")} />
        ) : (
          [...groups.entries()].map(([section, items]) => (
            <section key={section} className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-ink print:break-after-avoid">{section}</h2>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-3">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center break-inside-avoid"
                  >
                    {/* Разметку QR создаёт наш сервер из адреса и типа, данные пользователя в неё не попадают */}
                    <div
                      className="aspect-square w-full max-w-40 [&>svg]:size-full"
                      dangerouslySetInnerHTML={{ __html: s.svg }}
                    />
                    <div className="flex items-center gap-1.5">
                      <EquipmentIcon type={s.type} className="size-5 shrink-0 text-ink" />
                      <span className="text-base font-bold text-ink">{s.name}</span>
                    </div>
                    <span className="text-base text-ink-muted">{s.inventoryNo}</span>
                    <span className="text-sm text-ink-muted">{s.sectionName}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
