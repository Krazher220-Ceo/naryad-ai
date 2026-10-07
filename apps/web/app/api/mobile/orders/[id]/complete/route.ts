// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
import { after, NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { reviewOrder } from "@/lib/ai/review";

// Проверка ИИ идёт в after() и ограничена этим временем (бюджет в reviewOrder — 90 с).
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const client = createBearerClient(req);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { workDone, faultCode, materials = [], clientActionId } = body;

  if (!workDone || !clientActionId) {
    return NextResponse.json(
      { ok: false, error: "workDone and clientActionId are required" },
      { status: 400 }
    );
  }

  const formattedMaterials = materials.map((m: { materialId: string; qty: number }) => ({
    material_id: m.materialId,
    qty: m.qty,
  }));

  const { data, error } = await client.rpc("complete_order", {
    p_order_id: orderId,
    p_work_done: workDone,
    p_fault_code: faultCode || undefined,
    p_materials: formattedMaterials,
    p_client_action_id: clientActionId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // ИИ-проверка после ответа, как в completeOrder (lib/orders/actions.ts).
  after(() => reviewOrder(orderId).catch((e) => console.error("reviewOrder failed", e)));

  return NextResponse.json({ ok: true, status: data });
}
