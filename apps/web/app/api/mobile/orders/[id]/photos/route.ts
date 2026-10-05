import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const user = await client.auth.getUser();
  if (!user.data.user) {
    return NextResponse.json({ ok: false, error: "User session not found" }, { status: 401 });
  }

  const { data: employee } = await client
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();

  const body = await req.json().catch(() => ({}));
  const { kind, path } = body;

  if (!kind || !path) {
    return NextResponse.json({ ok: false, error: "kind and path are required" }, { status: 400 });
  }

  const { data, error } = await client.from("photos").insert({
    order_id: orderId,
    kind,
    storage_path: path,
    author_id: employee?.id ?? null,
  }).select("id").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, photoId: data.id });
}
