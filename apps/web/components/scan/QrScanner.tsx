// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { Button, Field, InlineNotice, TextInput } from "@/components/ui";

// Сканер QR-кода в приложении. Камера и распознавание — встроенный BarcodeDetector браузера
// (Chrome на Android), без новых библиотек. Где его нет — ввод номера с таблички вручную.
// Код ведёт на /q/<код>, а сервер уже решает, какой экран открыть этой роли.

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

// Из QR берём код: это либо адрес вида https://…/q/NSH-2, либо сам код.
export function codeFromQr(text: string): string {
  const match = text.match(/\/q\/([^/?#]+)/);
  return decodeURIComponent(match ? match[1] : text).trim();
}

export function QrScanner() {
  const t = useT();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "on" | "unsupported" | "denied">("starting");
  const [manual, setManual] = useState("");

  const open = (code: string) => {
    if (code) router.push(`/q/${encodeURIComponent(code)}`);
  };

  useEffect(() => {
    const BarcodeDetector = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    async function start() {
      if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
        setCameraState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setCameraState("denied");
        return;
      }
      if (stopped || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
      setCameraState("on");
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      // Четыре раза в секунду смотрим на кадр. Нашли код — сразу уходим.
      timer = setInterval(async () => {
        if (!videoRef.current) return;
        const found = await detector.detect(videoRef.current).catch(() => []);
        if (found[0]?.rawValue) {
          clearInterval(timer);
          router.push(`/q/${encodeURIComponent(codeFromQr(found[0].rawValue))}`);
        }
      }, 250);
    }

    start();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full max-w-md self-center overflow-hidden rounded-3xl bg-ink">
        <video ref={videoRef} muted playsInline className="size-full object-cover" />
        {/* Рамка прицела */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-accent" />
        {cameraState !== "on" && (
          <p className="absolute inset-x-4 bottom-4 rounded-xl bg-ink/80 p-3 text-center text-base font-semibold text-white">
            {cameraState === "starting" && t("scan.starting")}
            {cameraState === "unsupported" && t("scan.unsupported")}
            {cameraState === "denied" && t("scan.denied")}
          </p>
        )}
      </div>
      {cameraState === "on" && <InlineNotice>{t("scan.hint")}</InlineNotice>}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          open(codeFromQr(manual));
        }}
      >
        <Field label={t("scan.manualLabel")} htmlFor="scan-manual">
          <TextInput
            id="scan-manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={t("scan.manualPlaceholder")}
            autoCapitalize="characters"
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={!manual.trim()}>
          {t("scan.open")}
        </Button>
      </form>
    </div>
  );
}
