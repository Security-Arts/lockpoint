import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const lockId = params.id;

  // 1) read auth from cookie (user token)
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!jwt) {
    return NextResponse.json({ ok: false, error: "Missing auth" }, { status: 401 });
  }

  const { result, proof_text, proof_url } = await req.json();

  const normalized = String(result || "").toLowerCase();
  if (!["success", "fail"].includes(normalized)) {
    return NextResponse.json({ ok: false, error: "Invalid result" }, { status: 400 });
  }

  // Client with service role for transactional writes
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Client to validate user (using user's JWT)
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  // 2) load lock and verify ownership + status
  const { data: lock, error: lockErr } = await supabaseAdmin
    .from("locks")
    .select("id,user_id,status,deadline")
    .eq("id", lockId)
    .single();

  if (lockErr || !lock) {
    return NextResponse.json({ ok: false, error: "Lock not found" }, { status: 404 });
  }
  if (lock.user_id !== userId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!["active", "draft"].includes(String(lock.status || "").toLowerCase())) {
    return NextResponse.json({ ok: false, error: "Lock already finalized" }, { status: 400 });
  }

  // Optional: enforce deadline (comment out if you allow early outcome)
  if (lock.deadline && new Date(lock.deadline).getTime() > Date.now()) {
    return NextResponse.json({ ok: false, error: "Too early for outcome" }, { status: 400 });
  }

  // 3) write outcome event (unique index will block duplicates)
  const payload = { result: normalized, proof_text: proof_text || null, proof_url: proof_url || null };

  const { error: evErr } = await supabaseAdmin.from("lock_events").insert({
    lock_id: lockId,
    user_id: userId,
    event_type: "OUTCOME",
    payload
  });

  if (evErr) {
    // This is the "already has outcome" case
   const msg = String(evErr.message || "").toLowerCase();
 if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ ok: false, error: "Outcome already submitted" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: evErr.message }, { status: 500 });
  }

  // 4) finalize lock status
  const newStatus = normalized === "success" ? "completed" : "broken";
  const { error: upErr } = await supabaseAdmin
    .from("locks")
    .update({ status: newStatus })
    .eq("id", lockId)
    .eq("user_id", userId);

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
