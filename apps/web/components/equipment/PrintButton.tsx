"use client";

import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>{t("equipmentQr.print")}</Button>
  );
}
