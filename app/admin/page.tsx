import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function reqKeyOk(searchParams: Record<string, string | string[] | undefined>) {
  const key = (typeof searchParams.key === "string" ? searchParams.key : "").trim();
  const expected = (process.env.ADMIN_DASH_KEY || "").trim();

  // debug (не показує сам ключ)
  console.log("[admin] key_len=", key.length, "expected_len=", expected.length);

  return Boolean(key && expected && key === expected);
}


export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (!reqKeyOk(searchParams)) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin access denied</h1>
        <p>
          Open <code>/admin?key=YOUR_ADMIN_DASH_KEY</code>
        </p>
      </div>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, service, { auth: { persistSession: false } });

  const [funnel, sealRate, outcomes, timeToSeal, breakModes] = await Promise.all([
    supabase.from("v_analytics_funnel").select("*").single(),
    supabase.from("v_analytics_seal_rate").select("*").single(),
    supabase.from("v_analytics_outcomes").select("*"),
    supabase.from("v_analytics_time_to_seal").select("*").single(),
    supabase.from("v_analytics_break_modes").select("*").single(),
  ]);

  const err =
    funnel.error || sealRate.error || outcomes.error || timeToSeal.error || breakModes.error;

  if (err) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(err.message || err)}</pre>
      </div>
    );
  }

  const f: any = funnel.data;
  const s: any = sealRate.data;
  const t: any = timeToSeal.data;
  const b: any = breakModes.data;
  const o: any[] = outcomes.data || [];

  return (
    <div style={page}>
      <header style={header}>
        <h1 style={h1}>Admin · Reality Dashboard</h1>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Refresh to update</div>
      </header>

      <div style={grid}>
        <Metric title="Total users" value={f.total_users} />
        <Metric title="Total locks" value={f.total_locks} />
        <Metric title="Drafts" value={f.drafts} />
        <Metric title="Active" value={f.active} />
        <Metric title="Completed" value={f.completed} />
        <Metric title="Broken" value={f.broken} />
      </div>

      <div style={{ height: 14 }} />

      <div style={grid}>
        <Metric title="Seal rate" value={`${s.seal_rate_percent}%`} />
        <Metric title="Committed share" value={`${s.committed_share_percent}%`} />
        <Metric title="Median time to seal" value={fmt(t.median_time_to_seal)} />
        <Metric title="P90 time to seal" value={fmt(t.p90_time_to_seal)} />
        <Metric
          title="Manual break share"
          value={b.manual_break_share_percent === null ? "—" : `${b.manual_break_share_percent}%`}
        />
        <Metric title="Broken events total" value={b.total_broken_events} />
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Outcomes</div>
        {o.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No finished locks yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {o.map((row) => (
              <div key={row.status} style={rowLine}>
                <div style={{ fontWeight: 650 }}>{String(row.status).toUpperCase()}</div>
                <div style={{ opacity: 0.85 }}>{row.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: any }) {
  return (
    <div style={metricCard}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 750, marginTop: 6 }}>{value ?? "—"}</div>
    </div>
  );
}

function fmt(v: any) {
  if (!v) return "—";
  return String(v);
}

const page: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "28px 16px 60px" };
const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  marginBottom: 14,
};
const h1: React.CSSProperties = { margin: 0, fontSize: 22 };
const grid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};
const metricCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: 14,
};
const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: 14,
};
const rowLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 8,
};
