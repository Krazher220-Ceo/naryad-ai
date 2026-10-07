// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useSpeechLang, useT } from "@/components/LocaleProvider";
import { Button } from "./Button";
import { IconMic } from "./icons";

// Голосовой ввод через распознавание речи браузера (Web Speech API), без сторонних сервисов в коде.
// Chrome на Android поддерживает его из коробки. Если браузер не умеет, кнопка не показывается.

// В стандартных типах TypeScript этого API нет, описываем только то, что используем.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

type VoiceButtonProps = {
  // Распознанный текст. Экран сам решает, дописать его или заменить.
  onText: (text: string) => void;
};

export function VoiceButton({ onText }: VoiceButtonProps) {
  const t = useT();
  // Язык распознавания совпадает с языком интерфейса: ru-RU или kk-KZ.
  const lang = useSpeechLang();
  // На сервере кнопки нет, в браузере — если API доступен. Так нет расхождения при гидратации.
  const supported = useSyncExternalStore(noop, () => getRecognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  if (!supported) return null;

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    recognition.onerror = () => setFailed(true);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setFailed(false);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setFailed(true);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={listening ? "danger" : "secondary"}
        icon={<IconMic />}
        onClick={listening ? stop : start}
        aria-pressed={listening}
      >
        {listening ? t("ui.voice.stop") : t("ui.voice.start")}
      </Button>
      <p aria-live="polite" className="text-base text-ink-muted">
        {listening ? t("ui.voice.listening") : failed ? t("ui.voice.error") : ""}
      </p>
    </div>
  );
}

// Дописывает распознанную фразу к уже набранному тексту через пробел.
export function appendSpoken(current: string, spoken: string): string {
  const base = current.trimEnd();
  return base ? `${base} ${spoken}` : spoken;
}
