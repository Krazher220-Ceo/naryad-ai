// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import { resolveCode } from "@/lib/requests/lookup";
import { SectionMachines } from "./SectionMachines";

// QR цеха (PLAN.md, раздел 8.3): машины цеха по группам, поиск, «Сообщить о проблеме в цехе».
export default async function SectionPage({ params }: PageProps<"/operator/section/[code]">) {
  const { code } = await params;
  const t = await getT();
  const target = await resolveCode(code);
  if (target?.kind === "equipment") redirect(`/operator/report/${encodeURIComponent(target.code)}`);
  if (!target) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4">
        <EmptyState title={t("shell.titles.section")} text={t("report.notFound")} />
      </main>
    );
  }
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:max-w-3xl lg:py-8">
      <h1 className="text-2xl font-semibold text-ink lg:text-3xl">{target.section.name}</h1>
      <SectionMachines code={target.code} groups={target.groups} />
    </main>
  );
}
