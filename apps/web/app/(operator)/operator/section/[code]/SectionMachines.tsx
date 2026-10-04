"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { Field, IconChevronRight, TextInput } from "@/components/ui";
import type { SectionTarget } from "@/lib/requests/lookup";

// Машины цеха: группа → машина. Поиск по названию и инвентарному номеру.
export function SectionMachines({ code, groups }: { code: string; groups: SectionTarget["groups"] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      machines: g.machines.filter((m) => !q || m.name.toLowerCase().includes(q) || m.inventoryNo.toLowerCase().includes(q)),
    }))
    .filter((g) => g.machines.length > 0);

  const reportHref = (machine: string) => `/operator/report/${encodeURIComponent(code)}?machine=${machine}`;

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("sectionPage.search")} htmlFor="section-search">
        <TextInput
          id="section-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("sectionPage.searchPlaceholder")}
        />
      </Field>

      {filtered.length === 0 && <p className="text-base text-ink-muted">{t("sectionPage.nothing")}</p>}

      {filtered.map((g) => (
        <section key={g.type} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold capitalize text-ink">
            {g.type} · {g.machines.length}
          </h2>
          {g.machines.map((m) => (
            <Link
              key={m.id}
              href={reportHref(m.id)}
              className="flex min-h-touch items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:bg-canvas"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-base text-ink">{m.name}</b>
                <span className="text-sm text-ink-muted">{m.inventoryNo}</span>
              </span>
              <span
                className={
                  m.open
                    ? "rounded-lg bg-danger-soft px-2 py-1 text-sm font-bold text-danger"
                    : "rounded-lg bg-success-soft px-2 py-1 text-sm font-bold text-success"
                }
              >
                {m.open ? t("sectionPage.open") : t("sectionPage.ok")}
              </span>
              <IconChevronRight className="size-5 shrink-0 text-ink-muted" />
            </Link>
          ))}
        </section>
      ))}

      <Link
        href={reportHref("none")}
        className="flex min-h-touch items-center justify-center rounded-xl border-2 border-ink bg-surface px-5 text-lg font-semibold text-ink hover:bg-canvas"
      >
        {t("sectionPage.report")}
      </Link>
    </div>
  );
}
