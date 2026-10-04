"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button, Card, Toast } from "@/components/ui";
import { dismissRequest } from "@/lib/orders/actions";
import type { MasterBoard } from "@/lib/orders/queries";

// Попутные находки исполнителей: мастер выдаёт по ним наряд или отклоняет.
export function SideRequests({ requests }: { requests: MasterBoard["requests"] }) {
  const t = useT();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);

  if (requests.length === 0) return null;

  async function dismiss(id: string) {
    setBusyId(id);
    try {
      const res = await dismissRequest(id);
      setToast(res.ok ? { message: t("requests.dismissed"), tone: "success" } : { message: res.error, tone: "danger" });
    } catch {
      setToast({ message: t("orders.errors.unknown"), tone: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <Toast open={toast !== null} tone={toast?.tone ?? "success"} message={toast?.message ?? ""} onClose={() => setToast(null)} />
      <h2 className="text-xl font-bold text-ink">{t("requests.title")}</h2>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {requests.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-2">
              <p className="text-lg font-semibold text-ink">{r.equipment?.name ?? "—"}</p>
              <p className="text-base text-ink">{r.description}</p>
              <p className="text-base text-ink-muted">
                {t("requests.fromWorker")
                  .replace("{worker}", r.author?.full_name ?? "—")
                  .replace("{number}", String(r.parent?.number ?? "—"))}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/master/orders/new?request=${r.id}`}
                  className="inline-flex min-h-touch-sm items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-white hover:bg-brand-hover"
                >
                  {t("requests.issue")}
                </Link>
                <Button variant="secondary" size="md" loading={busyId === r.id} onClick={() => dismiss(r.id)}>
                  {t("requests.dismiss")}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
