import { after, NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { notifyStatusChange } from "@/lib/orders/notifications";


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
    after(() => notifyStatusChange({ orderId, action: "help", reason }).catch(console.error));
    return NextResponse.json({ ok: true, sent: true });
  }

  const { data, error } = await client.rpc("transition_order", {
    p_order_id: orderId,
    p_action: action,
    p_reason: reason,
    p_reason_code: reasonCode,
    p_client_action_id: clientActionId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // Уведомления после ответа, через after: иначе Vercel оборвёт их вместе с функцией.
  after(() => notifyStatusChange({ orderId, action, reason, reasonCode }).catch(console.error));

  return NextResponse.json({ ok: true, status: data });
}
