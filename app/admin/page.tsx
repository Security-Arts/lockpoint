// app/admin/page.tsx
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

// Next 16 may pass searchParams as a Promise in Server Components
async function unwrapSearchParams(searchParams: SP | Promise<SP> | undefined) {
  if (searchParams && typeof (searchParams as any).then === "function") {
    return (await searchParams) as SP;
  }
  return (searchParams ?? {}) as SP;
}

type TrajectoryRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  locked_at: string | null;
  dropped_at: string | null;
};

type AmendmentRow = {
  id: string;
  trajectory_id: string;
  kind: string;
  created_at: string;
};

function safeKey(sp: SP) {
  const v = sp.key;
  return (typeof v === "string" ? v : "").trim();
}

function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function pct(numer: number, denom: number) {
  if (!denom) return "—";
  const p = Math.round((numer / denom) * 100);
  return `${p}%`;
}

function msToHuman(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.round(s / 60);
  const h = Math.round(m / 60);
  const d = Math.round(h / 24);
  if (d >= 2) return `${d}d`;
  if (h >= 2) return `${h}h`;
  if (m >= 2) return `${m}m`;
  return `${s}s`;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base] ?? sorted[sorted.length - 1];
  const b = sorted[base + 1] ?? sorted[sorted.length - 1];
  return a + rest * (b - a);
}

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = await unwrapSearchParams(searchParams);

  const provided = safeKey(sp);
  const expected = (process.env.ADMIN_DASH_KEY || "").trim();

  // debug (does not reveal secrets)
  console.log("[admin] key_len=", provided.length, "expected_len=", expected.length);

  if (!(provided && expected && provided === expected)) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin access denied</h1>
        <p>
          Open <code>/admin?key=YOUR_ADMIN_DASH_KEY</code>
        </p>

        <hr style={{ opacity: 0.2, margin: "16px 0" }} />

        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          <div>provided_len: {provided.length}</div>
          <div>expected_len: {expected.length}</div>
        </div>
      </div>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, service, { auth: { persistSession: false } });

  // 1) Pull recent trajectories (enough to compute time-to-seal)
  // You can raise this limit later; 500 is safe + fast.
  const trajRes = await supabase
    .from("trajectories")
    .select("id,title,status,created_at,locked_at,dropped_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (trajRes.error) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {String(trajRes.error.message || trajRes.error)}
        </pre>
      </div>
    );
  }

  const trajectories = (trajRes.data ?? []) as TrajectoryRow[];

  // 2) Pull amendments (for outcome/break detection)
  const amendRes = await supabase
    .from("trajectory_amendments")
    .select("id,trajectory_id,kind,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (amendRes.error) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {String(amendRes.error.message || amendRes.error)}
        </pre>
      </div>
    );
  }

  const amendments = (amendRes.data ?? []) as AmendmentRow[];

  const totalTraj = trajectories.length;

  const locked = trajectories.filter(
    (t) => (t.status ?? "").toLowerCase() === "locked" || !!t.locked_at
  );
  const drafts = trajectories.filter((t) => (t.status ?? "").toLowerCase() === "draft");
  const dropped = trajectories.filter((t) => !!t.dropped_at);

  // Outcome detection: any OUTCOME amendment attached
  const outcomeSet = new Set(
    amendments
      .filter((a) => String(a.kind).toUpperCase() === "OUTCOME")
      .map((a) => a.trajectory_id)
  );

  // Break detection: dropped_at OR any DROP amendment
  const dropSet = new Set(
    amendments
      .filter((a) => String(a.kind).toUpperCase() === "DROP")
      .map((a) => a.trajectory_id)
  );

  const completed = locked.filter((t) => outcomeSet.has(t.id));
  const broken = locked.filter((t) => !!t.dropped_at || dropSet.has(t.id));

  // "Active": locked, not broken, not completed
  const active = locked.filter(
    (t) => !outcomeSet.has(t.id) && !(!!t.dropped_at || dropSet.has(t.id))
  );

  // Time to seal stats
  const timeToSealMs: number[] = locked
    .map((t) => {
      if (!t.locked_at) return null;
      const a = Date.parse(t.created_at);
      const b = Date.parse(t.locked_at);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return Math.max(0, b - a);
    })
    .filter((x): x is number => typeof x === "number")
    .sort((a, b) => a - b);

  const medianMs = quantile(timeToSealMs, 0.5);
  const p90Ms = quantile(timeToSealMs, 0.9);

  // Rates
  const totalLocks = locked.length;
  const sealRate = pct(totalLocks, totalTraj);
  const committedShare = pct(totalLocks, totalLocks + drafts.length);
  const manualBreakShare = pct(broken.length, totalLocks);

  const refreshHref = `/admin?key=${encodeURIComponent(provided)}&t=${Date.now()}`;

  // Recent locks
  const recentLocks = locked
    .slice()
    .sort((a, b) => {
      const aa = a.locked_at ? Date.parse(a.locked_at) : 0;
      const bb = b.locked_at ? Date.parse(b.locked_at) : 0;
      return bb - aa;
    })
    .slice(0, 12);

  // Outcomes breakdown (from amendments)
  // If you later store outcome status in trajectories, update this.
  const outcomeBreakdown = (() => {
    const map = new Map<string, number>();
    for (const a of amendments) {
      if (String(a.kind).toUpperCase() !== "OUTCOME") continue;
      // We don't have a "status" field in amendments, so just count outcomes
      map.set("outcome_recorded", (map.get("outcome_recorded") ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  })();

  return (
    <div style={page}>
      <header style={header}>
        <h1 style={h1}>Admin · Reality Dashboard</h1>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href={refreshHref} style={refreshBtn}>
            Refresh
          </a>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Server-rendered · no cache</div>
        </div>
      </header>

      <div style={grid}>
        <Metric title="Trajectories (loaded)" value={totalTraj} />
        <Metric title="Total locks" value={totalLocks} />
        <Metric title="Drafts" value={drafts.length} />
        <Metric title="Active" value={active.length} />
        <Metric title="Completed" value={completed.length} />
        <Metric title="Broken" value={broken.length} />
      </div>

      <div style={{ height: 14 }} />

      <div style={grid}>
        <Metric title="Seal rate" value={sealRate} />
        <Metric title="Committed share" value={committedShare} />
        <Metric title="Median time to seal" value={medianMs == null ? "—" : msToHuman(medianMs)} />
        <Metric title="P90 time to seal" value={p90Ms == null ? "—" : msToHuman(p90Ms)} />
        <Metric title="Manual break share" value={manualBreakShare} />
        <Metric title="Broken events total" value={dropped.length} />
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent locks</div>
        {recentLocks.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No locks found yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentLocks.map((t) => {
              const isDropped = !!t.dropped_at || dropSet.has(t.id);
              const isCompleted = outcomeSet.has(t.id);
              const state = isDropped ? "BROKEN" : isCompleted ? "COMPLETED" : "ACTIVE";

              return (
                <div key={t.id} style={rowLine}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.title || "(no title)"}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {shortId(t.id)}
                      </span>
                      {" · "}
                      <span style={{ opacity: 0.9 }}>{state}</span>
                      {" · "}
                      <span style={{ opacity: 0.8 }}>locked {fmtDate(t.locked_at)}</span>
                    </div>
                  </div>
                  <div style={{ opacity: 0.85, fontSize: 12, whiteSpace: "nowrap" }}>
                    created {fmtDate(t.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Outcomes</div>
        {outcomeBreakdown.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No finished locks yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {outcomeBreakdown.map((row) => (
              <div key={row.status} style={rowLine}>
                <div style={{ fontWeight: 650 }}>{String(row.status).toUpperCase()}</div>
                <div style={{ opacity: 0.85 }}>{fmt(row.count)}</div>
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
  gap: 12,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 8,
  paddingBottom: 8,
};
const refreshBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 650,
};
