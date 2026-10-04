"use client";

import { useEffect, useMemo, useRef } from "react";
import { useT } from "@/components/LocaleProvider";
import { Button } from "./Button";
import { IconCamera, IconImage, IconX } from "./icons";

type PhotoPickerProps = {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
};

// Выбор фото с камеры или из галереи, до max штук, с превью и удалением.
// Только интерфейс: отдаёт File[] через onChange. Загрузку в хранилище делает экран.
export function PhotoPicker({ value, onChange, max = 5 }: PhotoPickerProps) {
  const t = useT();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  // Ссылки на превью. Старые освобождаются, когда список меняется.
  const previews = useMemo(() => value.map((f) => URL.createObjectURL(f)), [value]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function add(list: FileList | null) {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    onChange([...value, ...images].slice(0, max));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<IconCamera />} disabled={full} onClick={() => cameraRef.current?.click()}>
          {t("ui.photo.camera")}
        </Button>
        <Button variant="secondary" icon={<IconImage />} disabled={full} onClick={() => galleryRef.current?.click()}>
          {t("ui.photo.gallery")}
        </Button>
      </div>

      {/* Скрытые поля выбора файла. capture открывает заднюю камеру на телефоне. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-base font-semibold text-ink-muted" aria-live="polite">
        {full
          ? t("ui.photo.limit").replace("{max}", String(max))
          : t("ui.photo.count").replace("{count}", String(value.length)).replace("{max}", String(max))}
      </p>

      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((url, i) => (
            <li key={url} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element -- локальное превью blob:, next/image тут не нужен */}
              <img src={url} alt={t("ui.photo.preview").replace("{n}", String(i + 1))} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={t("ui.photo.removeOne")}
                className="absolute right-0 top-0 flex size-touch-sm items-center justify-center rounded-bl-xl bg-ink/85 text-white active:bg-ink"
              >
                <IconX className="size-6" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
