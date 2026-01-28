import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

type TrajectoryRow = {
  id: string;
  title: string | null;
  commitment: string | null;
  status: string | null;
  deadline_at: string | null;
  stake_amount: number | null;
  stake_currency: string | null;
  is_public: boolean | null;
};

function pill(statusRaw?: string | null) {
  const s = String(statusRaw ?? "").toUpperCase();
  return s || "—";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // fallback generic
  const generic = () =>
    new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "70px",
            background: "#0a0a0a",
            color: "#fff",
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          <div style={{ opacity: 0.9 }}>Lockpoint</div>
          <div style={{ marginTop: 18, fontSize: 28, opacity: 0.75 }}>
            Public registry of locked decisions.
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );

  if (!id || !url || !anon) return generic();

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data } = await supabase
    .from("trajectories")
    .select("id,title,commitment,status,deadline_at,stake_amount,stake_currency,is_public")
    .eq("id", id)
    .maybeSingle();

  const t = data as TrajectoryRow | null;
  if (!t || t.is_public !== true) return generic();

  const title = (t.title || "Locked decision").slice(0, 80);
  const commitment = (t.commitment || "").trim().slice(0, 160);

  const metaParts: string[] = [];
  metaParts.push(`STATUS: ${pill(t.status)}`);
  if (t.deadline_at) metaParts.push(`DEADLINE: ${fmtDate(t.deadline_at)}`);
  if (t.stake_amount != null) metaParts.push(`STAKE: ${t.stake_amount} ${t.stake_currency || "USD"}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px",
          background: "#0a0a0a",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, opacity: 0.85 }}>Lockpoint</div>
          <div
            style={{
              fontSize: 18,
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              opacity: 0.95,
            }}
          >
            {pill(t.status)}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.08 }}>{title}</div>
          {commitment ? (
            <div style={{ marginTop: 18, fontSize: 26, lineHeight: 1.35, opacity: 0.85 }}>
              {commitment}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 18, opacity: 0.75 }}>{metaParts.join(" · ")}</div>
          <div style={{ fontSize: 16, opacity: 0.55 }}>lockpoint.me/t/{id.slice(0, 6)}…</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
