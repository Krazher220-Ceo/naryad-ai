// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { PHASH_PATTERN } from "@/lib/ai/phash";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const client = createBearerClient(req);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await client.auth.getUser();
  if (!user.data.user) {
    return NextResponse.json({ ok: false, error: "User session not found" }, { status: 401 });
  }

  const { data: employee } = await client
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { kind, path } = body;
  // Перцептивный хеш необязателен (старые версии приложения его не шлют), но если есть — 16 hex-символов.
  const phash: string | null = typeof body.phash === "string" ? body.phash.toLowerCase() : null;
  if (body.phash != null && (!phash || !PHASH_PATTERN.test(phash))) {
    return NextResponse.json({ ok: false, error: "phash must be 16 hex chars" }, { status: 400 });
  }

  if (!kind || !path) {
    return NextResponse.json({ ok: false, error: "kind and path are required" }, { status: 400 });
  }

  const { data, error } = await client.from("photos").insert({
    order_id: orderId,
    kind,
    path,
    author_id: employee.id,
    phash,
  }).select("id").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, photoId: data.id });
}
