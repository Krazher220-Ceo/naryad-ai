import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyStatusChange } from "@/lib/orders/notifications";

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
  const { action, reason, reasonCode, clientActionId } = body;

  if (!action || !clientActionId) {
    return NextResponse.json({ ok: false, error: "action and clientActionId are required" }, { status: 400 });
  }

  if (action === "help") {
    const { error } = await client.rpc("request_help", {
      p_order_id: orderId,
      p_comment: reason,
      p_client_action_id: clientActionId,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    notifyStatusChange({ orderId, action: "help", reason }).catch(console.error);
    return NextResponse.json({ ok: true, sent: true });
  }

  const { data, error } = await client.rpc("transition_order", {
    p_order_id: orderId,
    p_action: action,
    p_reason: reason,
    p_reason_code: reasonCode,
    p_comment: null,
    p_client_action_id: clientActionId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  notifyStatusChange({ orderId, action, reason, reasonCode }).catch(console.error);

  return NextResponse.json({ ok: true, status: data });
}
