"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Button, Card, Field, TextInput, useToast } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { getReporterName, setReporterName } from "@/lib/requests/device";

export function OperatorProfile({ accountName }: { accountName: string | null }) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    const saved = getReporterName();
    if (saved) queueMicrotask(() => setName(saved));
  }, []);

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink lg:text-3xl">{t("opProfile.title")}</h1>

      {accountName ? (
        <Card className="flex flex-col gap-1">
          <b className="text-xl text-ink">{accountName}</b>
          <span className="text-base text-ink-muted">{t("roles.operator")}</span>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <Field label={t("opProfile.name")} htmlFor="op-name" hint={t("opProfile.nameHint")}>
            <TextInput id="op-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("report.whoPlaceholder")} autoComplete="name" />
          </Field>
          <Button
            onClick={() => {
              setReporterName(name);
              toast.show("saved");
            }}
          >
            {t("opProfile.save")}
          </Button>
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <span className="text-base font-semibold text-ink">{t("opProfile.language")}</span>
        <LanguageSwitch full />
      </Card>

      {accountName ? (
        <form action={signOut}>
          <button type="submit" className="min-h-touch w-full rounded-xl border-2 border-danger bg-surface px-5 text-lg font-semibold text-danger hover:bg-danger-soft">
            {t("profile.signOut")}
          </button>
        </form>
      ) : (
        <Card className="flex flex-col gap-3">
          <p className="text-base text-ink-muted">{t("opProfile.loginHint")}</p>
          <Link href="/login" className="flex min-h-touch items-center justify-center rounded-xl border-2 border-ink bg-surface px-5 text-lg font-semibold text-ink hover:bg-canvas">
            {t("opProfile.login")}
          </Link>
        </Card>
      )}
    </>
  );
}
