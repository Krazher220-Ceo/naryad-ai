import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reviewOrder } from "@/lib/ai/review";

function getBearerClient(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const client = getBearerClient(req);
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
    p_fault_code: faultCode || null,
    p_materials: formattedMaterials,
    p_comment: null,
    p_client_action_id: clientActionId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  reviewOrder(orderId).catch((e) => console.error("Mobile complete reviewOrder error", e));

  return NextResponse.json({ ok: true, status: data });
}
