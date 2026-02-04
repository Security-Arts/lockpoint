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
  const s = String(statusRaw ?? "").trim().toUpperCase();
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

// легка валідація UUID (досить для анти-скану)
function looksLikeUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function clampText(s: string, max: number) {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function titleFontSize(title: string) {
  const n = title.length;
  if (n <= 42) return 56;
  if (n <= 60) return 50;
  if (n <= 80) return 44;
  return 40;
}

function commitmentFontSize(commitment: string) {
  const n = commitment.length;
  if (n <= 90) return 28;
  if (n <= 140) return 26;
  return 24;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const origin = (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return "https://lockpoint.vercel.app";
    }
  })();

  const cacheHeaders = {
    // OG можна кешувати довго на edge/CDN, але при цьому дозволити оновлення
    "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
  };

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
            fontWeight: 800,
          }}
        >
          <div style={{ opacity: 0.92 }}>Lockpoint</div>
          <div style={{ marginTop: 18, fontSize: 28, opacity: 0.75 }}>
            Public registry of locked decisions.
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: cacheHeaders }
    );

  // базові перевірки
  if (!id || !url || !anon) return generic();
  if (!looksLikeUuid(id)) return generic();

  try {
    const supabase = createClient(url, anon, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("trajectories")
      .select("id,title,commitment,status,deadline_at,stake_amount,stake_currency,is_public")
      .eq("id", id)
      .maybeSingle();

    if (error) return generic();

    const t = data as TrajectoryRow | null;
    if (!t || t.is_public !== true) return generic();

    const title = clampText(t.title || "Locked decision", 90);
    const commitment = clampText(t.commitment || "", 180);

    const metaParts: string[] = [];
    metaParts.push(`STATUS: ${pill(t.status)}`);
    if (t.deadline_at) metaParts.push(`DEADLINE: ${fmtDate(t.deadline_at)}`);
    if (t.stake_amount != null)
      metaParts.push(`STAKE: ${t.stake_amount} ${t.stake_currency || "USD"}`);

    const footerHost = (() => {
      try {
        return new URL(origin).host;
      } catch {
        return "lockpoint.vercel.app";
      }
    })();

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
            <div style={{ fontSize: 26, opacity: 0.86 }}>Lockpoint</div>
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
            <div
              style={{
                fontSize: titleFontSize(title),
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: -0.5,
              }}
            >
              {title}
            </div>

            {commitment ? (
              <div
                style={{
                  marginTop: 18,
                  fontSize: commitmentFontSize(commitment),
                  lineHeight: 1.35,
                  opacity: 0.86,
                }}
              >
                {commitment}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 18, opacity: 0.75 }}>{metaParts.join(" · ")}</div>
            <div style={{ fontSize: 16, opacity: 0.55 }}>
              {footerHost}/t/{id.slice(0, 6)}…
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: cacheHeaders }
    );
  } catch {
    return generic();
  }
}
