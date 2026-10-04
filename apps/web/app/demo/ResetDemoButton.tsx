"use client";

import { useState } from "react";
import { Button, ConfirmSheet, InlineNotice } from "@/components/ui";
import { resetDemo } from "@/lib/demo/actions";
import { useT } from "@/components/LocaleProvider";

export function ResetDemoButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setNotice(null);
    try {
      const res = await resetDemo();
      setLoading(false);
      setOpen(false);
      if (res.ok) {
        setNotice({ ok: true, message: t("demo.resetSuccess") });
      } else {
        setNotice({ ok: false, message: res.error });
      }
    } catch {
      setLoading(false);
      setOpen(false);
      setNotice({ ok: false, message: t("demo.resetFailed") });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="danger"
          size="lg"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto"
        >
          {t("demo.resetButton")}
        </Button>
      </div>

      {notice && (
        <InlineNotice tone={notice.ok ? "success" : "danger"}>
          {notice.message}
        </InlineNotice>
      )}

      <ConfirmSheet
        open={open}
        title={t("demo.resetConfirmTitle")}
        description={t("demo.resetConfirmText")}
        confirmLabel={t("demo.resetConfirmButton")}
        tone="danger"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
