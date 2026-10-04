import { NextResponse } from "next/server";
import { transcribeAudio, parseOrderSpeech } from "@/lib/ai/voice";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

// Диктофон: запись → текст (Whisper на Mac) → поля наряда (только мастеру, mode=order).
// Без входа маршрут закрыт: распознавание на нашем Mac не открываем всем подряд.
// Не получилось распознать — отвечаем text: null, и телефон предлагает своё распознавание.

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const t = await getT();
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ ok: false, error: t("orders.errors.forbidden") }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, error: t("voice.errors.audio") }, { status: 400 });
  }
  const lang = String(form?.get("lang") ?? "ru");
  const mode = String(form?.get("mode") ?? "text");

  const transcript = await transcribeAudio(audio, lang);
  if (!transcript) return NextResponse.json({ ok: true, text: null });

  if (mode !== "order" || employee.role !== "master") {
    return NextResponse.json({ ok: true, text: transcript.text, source: transcript.source });
  }

  const supabase = await createClient();
  const [equipment, workers, faultCodes] = await Promise.all([
    supabase.from("equipment").select("id, name, inventory_no"),
    supabase.from("worker_board").select("id, full_name"),
    supabase.from("fault_codes").select("code, name"),
  ]);
  const fields = await parseOrderSpeech(transcript.text, {
    equipment: equipment.data ?? [],
    workers: (workers.data ?? []).filter((w): w is { id: string; full_name: string } => Boolean(w.id && w.full_name)),
    faultCodes: faultCodes.data ?? [],
  });
  return NextResponse.json({ ok: true, text: transcript.text, source: transcript.source, fields });
}
