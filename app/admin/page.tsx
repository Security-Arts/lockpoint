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
  locked_at: string | null;
  dropped_at: string | null;
  stake_amount: number | null;
  stake_currency: string | null;
  lock_reason: string | null;
};

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

  // Load trajectories (for metrics) + recent locks
  const [{ data: all, error: allErr }, { data: recentLocks, error: locksErr }] =
    await Promise.all([
      supabase
        .from("trajectories")
        .select(
          "id,title,status,created_at,locked_at,dropped_at,stake_amount,stake_currency,lock_reason"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("trajectories")
        .select(
          "id,title,status,created_at,locked_at,dropped_at,stake_amount,stake_currency,lock_reason"
        )
        .not("locked_at", "is", null)
        .order("locked_at", { ascending: false })
        .limit(10),
    ]);

  const err = allErr || locksErr;
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

  const totalTraj = rows.length;
  const totalLocks = rows.filter((r) => !!r.locked_at || (r.status ?? "").toLowerCase() === "locked")
    .length;
  const drafts = rows.filter((r) => (r.status ?? "").toLowerCase() === "draft").length;

  // Optional: define "active/completed/broken" if you later add statuses.
  const active = rows.filter((r) => (r.status ?? "").toLowerCase() === "active").length;
  const completed = rows.filter((r) => (r.status ?? "").toLowerCase() === "completed").length;
  const broken = rows.filter((r) => (r.status ?? "").toLowerCase() === "broken").length;

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
        <Metric title="Total locks" value={totalLocks} />
        <Metric title="Drafts" value={drafts} />
        <Metric title="Active" value={active} />
        <Metric title="Completed" value={completed} />
        <Metric title="Broken" value={broken} />
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent locks</div>
        {locks.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No locks found yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {locks.map((r) => (
              <div key={r.id} style={lockRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.title || "(untitled)"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    <span style={mono}>{shortId(r.id)}</span>{" "}
                    {" · locked "} {fmtDate(r.locked_at)}
                  </div>
                  {r.lock_reason ? (
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, whiteSpace: "pre-wrap" }}>
                      {r.lock_reason}
                    </div>
                  ) : null}
                </div>

                <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                  <div style={{ fontWeight: 650 }}>
                    {r.stake_amount != null ? `${r.stake_amount} ${r.stake_currency || "USD"}` : "—"}
                  </div>
                  <div style={{ opacity: 0.7, marginTop: 4 }}>stake</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Outcomes</div>
        <div style={{ opacity: 0.75 }}>
          (Will appear once you implement outcome tracking in DB/statuses.)
        </div>
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
const refreshLink: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 650,
  textDecoration: "none",
  borderBottom: "1px solid rgba(255,255,255,0.35)",
  paddingBottom: 2,
};
const lockRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 10,
};
const mono: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
