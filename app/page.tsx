// app/admin/page.tsx
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

async function unwrapSearchParams(searchParams: SP | Promise<SP> | undefined) {
  if (searchParams && typeof (searchParams as any).then === "function") {
    return (await searchParams) as SP;
  }
  return (searchParams ?? {}) as SP;
}

type TrajRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  locked_at: string | null;
  dropped_at: string | null;
  stake_amount: number | null;
  stake_currency: string | null;
  lock_reason: string | null;
  is_public?: boolean | null;
};

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

function normStatus(s?: string | null) {
  return String(s ?? "").toLowerCase();
}

function statusBadge(status?: string | null) {
  const s = normStatus(status);
  if (s === "draft") return { label: "DRAFT", bg: "rgba(0,0,0,0.05)", fg: "rgba(0,0,0,0.75)" };
  if (s === "locked") return { label: "LOCKED", bg: "rgba(0,0,0,0.08)", fg: "rgba(0,0,0,0.85)" };
  if (s === "completed") return { label: "COMPLETED", bg: "rgba(0,0,0,0.10)", fg: "rgba(0,0,0,0.9)" };
  if (s === "failed") return { label: "FAILED", bg: "rgba(0,0,0,0.10)", fg: "rgba(0,0,0,0.9)" };
  return { label: (status ?? "—").toUpperCase(), bg: "rgba(0,0,0,0.05)", fg: "rgba(0,0,0,0.75)" };
}

function pillStyle(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: bg,
    color: fg,
    letterSpacing: 0.3,
    border: "1px solid rgba(0,0,0,0.08)",
    whiteSpace: "nowrap",
  };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = await unwrapSearchParams(searchParams);

  const provided = (typeof sp.key === "string" ? sp.key : "").trim();
  const expected = (process.env.ADMIN_DASH_KEY || "").trim();

  if (!(provided && expected && provided === expected)) {
    return (
      <div style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
        <h1>Admin access denied</h1>
        <p>
          Open <code>/admin?key=YOUR_ADMIN_DASH_KEY</code>
        </p>
        <hr style={{ opacity: 0.2, margin: "16px 0" }} />
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Tip: keep the key long (40+ chars) and never share the URL.
        </div>
      </div>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, service, { auth: { persistSession: false } });

  // Data pulls (server role = bypass RLS)
  const [
    { data: all, error: allErr },
    { data: recentLocks, error: locksErr },
    { data: recentOutcomes, error: outErr },
  ] = await Promise.all([
    supabase
      .from("trajectories")
      .select(
        "id,title,status,created_at,updated_at,locked_at,dropped_at,stake_amount,stake_currency,lock_reason,is_public"
      )
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("trajectories")
      .select(
        "id,title,status,created_at,updated_at,locked_at,dropped_at,stake_amount,stake_currency,lock_reason,is_public"
      )
      .not("locked_at", "is", null)
      .order("locked_at", { ascending: false })
      .limit(12),
    // Outcomes should be derived from trajectory status (source of truth)
    supabase
      .from("trajectories")
      .select(
        "id,title,status,created_at,updated_at,locked_at,dropped_at,stake_amount,stake_currency,lock_reason,is_public"
      )
      .in("status", ["completed", "failed", "dropped"])
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const err = allErr || locksErr || outErr;
  if (err) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(err.message || err)}</pre>
      </div>
    );
  }

  const rows = (all ?? []) as TrajRow[];
  const locks = (recentLocks ?? []) as TrajRow[];
  const outcomes = (recentOutcomes ?? []) as TrajRow[];

  // Metrics (truth = trajectories.status)
  const totalTraj = rows.length;
  const drafts = rows.filter((r) => normStatus(r.status) === "draft").length;
  const locked = rows.filter((r) => normStatus(r.status) === "locked").length;
  const completed = rows.filter((r) => normStatus(r.status) === "completed").length;
  const failed = rows.filter((r) => normStatus(r.status) === "failed" || normStatus(r.status) === "dropped").length;

  // Total locks = everything that has moved past draft
  const totalLocks = locked + completed + failed;

  // Active = locked only (not finalized yet)
  const active = locked;

  // Dropped-drafts heuristic: failed + dropped_at present + locked_at null (optional, informational)
  const droppedDrafts = rows.filter(
    (r) => normStatus(r.status) === "failed" && !!r.dropped_at && !r.locked_at
  ).length;

  // Public count
  const publicCount = rows.filter((r) => r.is_public === true).length;

  const refreshHref = `/admin?key=${encodeURIComponent(provided)}&t=${Date.now()}`;

  return (
    <div style={page}>
      <header style={header}>
        <h1 style={h1}>Admin · Reality Dashboard</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          <a href={refreshHref} style={refreshLink}>
            Refresh
          </a>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Server-rendered · no cache</div>
        </div>
      </header>

      <div style={grid}>
        <Metric title="Trajectories (loaded)" value={totalTraj} />
        <Metric title="Total locks (post-draft)" value={totalLocks} />
        <Metric title="Drafts" value={drafts} />
        <Metric title="Active (locked)" value={active} />
        <Metric title="Completed" value={completed} />
        <Metric title="Dropped/Failed" value={failed} />
        <Metric title="Public (is_public=true)" value={publicCount} />
        <Metric title="Dropped drafts (heuristic)" value={droppedDrafts} />
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Recent locks</div>
        {locks.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No locks found yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {locks.map((r) => {
              const b = statusBadge(r.status);
              return (
                <div key={r.id} style={lockRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={pillStyle(b.bg, b.fg)}>{b.label}</span>
                      {r.is_public ? <span style={pillStyle("rgba(0,0,0,0.08)", "rgba(0,0,0,0.85)")}>PUBLIC</span> : null}
                    </div>

                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", marginTop: 6 }}>
                      {r.title || "(untitled)"}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      <span style={mono}>{shortId(r.id)}</span>
                      {" · locked "} {fmtDate(r.locked_at)}
                      {r.updated_at ? ` · updated ${fmtDate(r.updated_at)}` : ""}
                    </div>

                    {r.lock_reason ? (
                      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {r.lock_reason}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                    <div style={{ fontWeight: 750 }}>
                      {r.stake_amount != null ? `${r.stake_amount} ${r.stake_currency || "USD"}` : "—"}
                    </div>
                    <div style={{ opacity: 0.7, marginTop: 4 }}>stake</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Recent outcomes (by status)</div>
        {outcomes.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No outcomes yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {outcomes.slice(0, 12).map((r) => {
              const b = statusBadge(r.status);
              const isDroppedDraft = normStatus(r.status) === "failed" && !!r.dropped_at && !r.locked_at;

              return (
                <div key={r.id} style={lockRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={pillStyle(b.bg, b.fg)}>{b.label}</span>
                      {r.is_public ? <span style={pillStyle("rgba(0,0,0,0.08)", "rgba(0,0,0,0.85)")}>PUBLIC</span> : null}
                      {isDroppedDraft ? (
                        <span style={pillStyle("rgba(0,0,0,0.06)", "rgba(0,0,0,0.75)")}>DROPPED DRAFT</span>
                      ) : null}
                    </div>

                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", marginTop: 6 }}>
                      {r.title || "(untitled)"}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      <span style={mono}>{shortId(r.id)}</span>
                      {r.locked_at ? ` · locked ${fmtDate(r.locked_at)}` : ""}
                      {r.updated_at ? ` · updated ${fmtDate(r.updated_at)}` : ""}
                    </div>

                    {r.lock_reason ? (
                      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {r.lock_reason}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                    <div style={{ fontWeight: 750 }}>
                      {r.stake_amount != null ? `${r.stake_amount} ${r.stake_currency || "USD"}` : "—"}
                    </div>
                    <div style={{ opacity: 0.7, marginTop: 4 }}>stake</div>
                  </div>
                </div>
              );
            })}
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
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value ?? "—"}</div>
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
  border: "1px solid rgba(0,0,0,0.10)",
  background: "rgba(0,0,0,0.02)",
  borderRadius: 14,
  padding: 14,
};
const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  background: "rgba(0,0,0,0.02)",
  borderRadius: 14,
  padding: 14,
};
const refreshLink: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 750,
  textDecoration: "none",
  borderBottom: "1px solid rgba(0,0,0,0.35)",
  paddingBottom: 2,
};
const lockRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  borderTop: "1px solid rgba(0,0,0,0.08)",
  paddingTop: 10,
};
const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
