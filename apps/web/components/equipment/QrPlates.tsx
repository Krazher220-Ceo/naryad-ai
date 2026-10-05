"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, EmptyState } from "@/components/ui";
import { Select } from "@/components/ui/Field";
import { PLATE_H, PLATE_W, plateSvg, type PlateData, type PlateLabels } from "./plate";

type PrintJob = { mode: "one" | "four"; ids: string[] };

// Шрифты для скачанного файла: Oswald на чужом компьютере может не быть, поэтому есть запасные.
const FILE_HEADING = "Oswald, 'Arial Narrow', Arial, sans-serif";
const PAGE_HEADING = "var(--font-display), Oswald, Arial, sans-serif";

function fileName(plate: PlateData, ext: string): string {
  return `qr-${plate.inventoryNo.replace(/[^\p{L}\p{N}-]+/gu, "_")}.${ext}`;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function QrPlates({ plates, labels, logoInner }: { plates: PlateData[]; labels: PlateLabels; logoInner: string }) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [section, setSection] = useState("");
  const [job, setJob] = useState<PrintJob | null>(null);

  const sections = useMemo(() => [...new Set(plates.map((p) => p.sectionName))], [plates]);
  const visible = plates.filter((p) => !section || p.sectionName === section);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  // Одна табличка — один SVG. На странице шрифт сайта, в файле запасной.
  const svgFor = (p: PlateData, heading: string) => plateSvg(p, labels, logoInner, heading);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    const next = new Set(selected);
    for (const p of visible) {
      if (allVisibleSelected) next.delete(p.id);
      else next.add(p.id);
    }
    setSelected(next);
  }

  function downloadSvg(p: PlateData) {
    saveBlob(new Blob([svgFor(p, FILE_HEADING)], { type: "image/svg+xml" }), fileName(p, "svg"));
  }

  // PNG: рисуем SVG на canvas в двойном размере (1200 x 1680) и сохраняем.
  function downloadPng(p: PlateData) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PLATE_W * 2;
      canvas.height = PLATE_H * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob && saveBlob(blob, fileName(p, "png")), "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgFor(p, FILE_HEADING));
  }

  // Печать: сначала рисуем нужные листы, потом открываем диалог печати.
  useEffect(() => {
    if (!job) return;
    const done = () => setJob(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [job]);

  const printIds = job ? job.ids : [];
  const printPlates = plates.filter((p) => printIds.includes(p.id));
  const pages: PlateData[][] = [];
  if (job?.mode === "one") for (const p of printPlates) pages.push([p]);
  if (job?.mode === "four") for (let i = 0; i < printPlates.length; i += 4) pages.push(printPlates.slice(i, i + 4));

  if (plates.length === 0) {
    return <EmptyState title={t("equipmentQr.emptyTitle")} text={t("equipmentQr.emptyText")} />;
  }

  const selectedIds = plates.filter((p) => selected.has(p.id)).map((p) => p.id);

  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="lg:w-72">
            <Select
              aria-label={t("equipmentQr.filterSection")}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder={t("equipmentQr.allSections")}
              options={sections.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <Button variant="secondary" onClick={toggleAll}>
            {allVisibleSelected ? t("equipmentQr.clearAll") : t("equipmentQr.selectAll")}
          </Button>
          <span className="text-base font-semibold text-ink lg:flex-1">
            {t("equipmentQr.selected").replace("{n}", String(selectedIds.length))}
          </span>
          <Button disabled={selectedIds.length === 0} onClick={() => setJob({ mode: "four", ids: selectedIds })}>
            {t("equipmentQr.printFour")}
          </Button>
          <Button
            variant="secondary"
            disabled={selectedIds.length === 0}
            onClick={() => setJob({ mode: "one", ids: selectedIds })}
          >
            {t("equipmentQr.printOnePerPage")}
          </Button>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <li key={p.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
              <label className="flex min-h-touch cursor-pointer items-center gap-3 text-lg font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="size-6 shrink-0 accent-brand"
                />
                <span className="min-w-0 truncate">{p.inventoryNo}</span>
              </label>
              {/* Разметку табличке даёт plateSvg из данных справочника, текст в ней экранируется */}
              <div
                className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svgFor(p, PAGE_HEADING) }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="whitespace-nowrap px-2 text-base" onClick={() => downloadPng(p)}>
                  {t("equipmentQr.downloadPng")}
                </Button>
                <Button variant="secondary" className="whitespace-nowrap px-2 text-base" onClick={() => downloadSvg(p)}>
                  {t("equipmentQr.downloadSvg")}
                </Button>
                <Button className="col-span-2" onClick={() => setJob({ mode: "one", ids: [p.id] })}>
                  {t("equipmentQr.printOne")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Листы для печати: на экране скрыты (см. globals.css) */}
      {job && (
        <div className={`plates-print plates-print-${job.mode}`}>
          {pages.map((page, i) => (
            <div key={i} className="print-page">
              {page.map((p) => (
                <div key={p.id} className="print-cell" dangerouslySetInnerHTML={{ __html: svgFor(p, PAGE_HEADING) }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
