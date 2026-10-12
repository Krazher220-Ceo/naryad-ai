// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechLang, useT } from "@/components/LocaleProvider";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconMic, IconPause, IconPlay, IconX } from "./icons";
import { Sheet } from "./Sheet";
import { VoiceButton, appendSpoken } from "./VoiceButton";

// Диктофон, как на телефоне (набросок «Выдача голосом»): волна, таймер, пауза, стоп, отмена.
// Запись уходит на сервер (/api/voice): Whisper на нашем Mac, затем разбор по полям.
// Сервер не распознал или нет сети — предлагаем распознавание телефона, текст без разбора.
// Поля из речи человек видит с пометкой «проверьте» и сам решает, заполнить ли форму.

export type DictatedFields = {
  problem: string | null;
  equipmentId: string | null;
  priority: "emergency" | "high" | "normal" | "planned" | null;
  faultCode: string | null;
  assigneeId: string | null;
};

type Props = {
  // order — разобрать речь по полям наряда (мастер), text — только текст.
  mode: "order" | "text";
  onText: (text: string) => void;
  onFields?: (fields: DictatedFields) => void;
  // Как показать поля человеку: id машины и исполнителя → названия.
  describe?: (fields: DictatedFields) => { label: string; value: string }[];
};

type Stage = "idle" | "recording" | "paused" | "processing" | "result" | "fallback";

const BARS = 40;

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")},${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
}

export function Dictaphone({ mode, onText, onFields, describe }: Props) {
  const t = useT();
  const lang = useSpeechLang();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.05));
  const [text, setText] = useState("");
  const [fields, setFields] = useState<DictatedFields | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const accumulated = useRef(0);
  const cancelled = useRef(false);

  const stopAll = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
  }, []);

  useEffect(() => stopAll, [stopAll]);

  async function send(blob: Blob) {
    setStage("processing");
    try {
      const form = new FormData();
      form.set("audio", blob, "speech.webm");
      form.set("lang", lang);
      form.set("mode", mode);
      const res = await fetch("/api/voice", { method: "POST", body: form });
      const body = (await res.json()) as { ok: boolean; text?: string | null; fields?: DictatedFields; error?: string };
      if (!body.ok || !body.text) {
        setStage("fallback");
        return;
      }
      setText(body.text);
      setFields(body.fields ?? null);
      setStage("result");
    } catch {
      setStage("fallback");
    }
  }

  async function start() {
    setError(null);
    setText("");
    setFields(null);
    if (!navigator.onLine || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStage("fallback");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t("voice.errors.mic"));
      setStage("fallback");
      return;
    }
    // Волна: громкость с микрофона 10 раз в секунду, последние 40 значений.
    const ctx = new AudioContext();
    audioCtx.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream.current).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 100) {
        last = now;
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
        const paused = recorder.current?.state === "paused";
        setLevels((prev) => [...prev.slice(1), paused ? 0.05 : Math.max(0.05, Math.min(1, peak * 2.2))]);
        setElapsed(accumulated.current + (paused ? 0 : performance.now() - startedAt.current));
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    chunks.current = [];
    cancelled.current = false;
    const rec = new MediaRecorder(stream.current);
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      stopAll();
      if (cancelled.current) return;
      void send(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
    };
    recorder.current = rec;
    accumulated.current = 0;
    startedAt.current = performance.now();
    rec.start();
    setStage("recording");
  }

  function pause() {
    const rec = recorder.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      accumulated.current += performance.now() - startedAt.current;
      setStage("paused");
    } else if (rec.state === "paused") {
      startedAt.current = performance.now();
      rec.resume();
      setStage("recording");
    }
  }

  function stop() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  function cancel() {
    cancelled.current = true;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    stopAll();
    setStage("idle");
    setElapsed(0);
    setLevels(Array(BARS).fill(0.05));
  }

  function close() {
    cancel();
    setOpen(false);
  }

  function apply() {
    if (fields && onFields) onFields(fields);
    onText(fields?.problem ?? text);
    close();
  }

  const recording = stage === "recording" || stage === "paused";
  const rows = fields && describe ? describe(fields) : [];

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<IconMic />}
        onClick={() => {
          setOpen(true);
          void start();
        }}
      >
        {t("voice.open")}
      </Button>

      <Sheet open={open} title={t("voice.title")} onClose={close}>
        <p className="text-base text-ink-muted">{t(mode === "order" ? "voice.hintOrder" : "voice.hintText")}</p>

        {(recording || stage === "processing") && (
          <section aria-label={t("voice.title")} className="flex flex-col items-center gap-3 rounded-2xl bg-ink p-4 text-white">
            <div className="flex h-20 w-full items-center gap-[3px]" aria-hidden="true">
              {levels.map((v, i) => (
                <span
                  key={i}
                  className={cx("flex-1 rounded-full", stage === "paused" ? "bg-white/30" : "bg-accent")}
                  style={{ height: `${Math.round(v * 100)}%` }}
                />
              ))}
            </div>
            <div className="font-display text-4xl tabular-nums" aria-live="off">
              {formatTime(elapsed)}
            </div>
            {stage === "processing" && <p className="text-base font-semibold">{t("voice.processing")}</p>}
          </section>
        )}

        {recording && (
          <div className="grid grid-cols-3 items-center gap-3">
            <button
              type="button"
              onClick={cancel}
              aria-label={t("voice.cancel")}
              className="flex size-16 items-center justify-center justify-self-center rounded-full border-2 border-line-strong text-ink"
            >
              <IconX className="size-7" />
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label={t("voice.stop")}
              className="flex size-20 items-center justify-center justify-self-center rounded-full bg-danger"
            >
              <span className="size-7 rounded-md bg-white" />
            </button>
            <button
              type="button"
              onClick={pause}
              aria-label={stage === "paused" ? t("voice.resume") : t("voice.pause")}
              className="flex size-16 items-center justify-center justify-self-center rounded-full border-2 border-line-strong text-base font-bold text-ink"
            >
              {stage === "paused" ? <IconPlay /> : <IconPause />}
            </button>
          </div>
        )}

        {stage === "result" && (
          <section className="flex flex-col gap-3">
            <div className="rounded-2xl bg-canvas p-4">
              <div className="text-sm font-bold tracking-wide uppercase text-ink-muted">{t("voice.recognized")}</div>
              <p className="text-lg text-ink">«{text}»</p>
            </div>
            {rows.length > 0 && (
              <div className="rounded-2xl border-2 border-accent p-4">
                <div className="mb-2 text-sm font-bold tracking-wide uppercase text-accent-ink">{t("voice.checkFields")}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
                  {rows.map((r) => (
                    <div key={r.label} className="contents">
                      <dt className="text-ink-muted">{r.label}</dt>
                      <dd className="font-bold text-ink">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => void start()}>
                {t("voice.again")}
              </Button>
              <Button onClick={apply}>{t(rows.length ? "voice.fill" : "voice.insert")}</Button>
            </div>
          </section>
        )}

        {stage === "fallback" && (
          <section className="flex flex-col gap-3">
            {error && <p className="text-base font-semibold text-danger">{error}</p>}
            <p className="text-base text-ink">{t("voice.fallback")}</p>
            <VoiceButton onText={(spoken) => setText((cur) => appendSpoken(cur, spoken))} />
            {text && <p className="rounded-2xl bg-canvas p-4 text-lg text-ink">«{text}»</p>}
            <Button disabled={!text} onClick={apply}>
              {t("voice.insert")}
            </Button>
          </section>
        )}

        {stage === "idle" && (
          <Button onClick={() => void start()} icon={<IconMic />}>
            {t("voice.start")}
          </Button>
        )}
      </Sheet>
    </>
  );
}
