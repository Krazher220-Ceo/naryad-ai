"use client";

import { Button } from "@/components/ui";
import { useT } from "@/components/LocaleProvider";

export function PrintButton() {
  const t = useT();
  return (
    <Button onClick={() => window.print()}>{t("equipmentQr.print")}</Button>
  );
}
