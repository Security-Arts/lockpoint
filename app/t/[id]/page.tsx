"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ShareBar from "@/components/ShareBar";

type TrajectoryStatus = "draft" | "locked" | "completed" | "dropped" | "failed";

type Trajectory = {
  id: string;
  owner_id: string | null;
  title: string;
  commitment: string | null;
  status: TrajectoryStatus | string | null;
  created_at: string;
  locked_at?: string | null;
  dropped_at?: string | null;
  deadline_at?: string | null;
  lock_reason?: string | null;
  stake_amount?: number | null;
  stake_currency?: string | null;
  is_public?: boolean | null;
};

type Amendment = {
  id: string;
  trajectory_id: string;
  kind: string;
  content: string;
  created_at: string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return String(iso);
  }
}

function isPublicByStatus(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "locked" || s === "completed" || s === "dropped" || s === "failed";
}

export default function TrajectoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [me, setMe] = useState<string | null>(null);
  const [t, setT] = useState<Trajectory | null>(null);
  const [amends, setAmends] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const statusLower = useMemo(() => (t?.status ?? "").toLowerCase(), [t?.status]);
  const isOwner = useMemo(() => { if (!t || !me) return false; return t.owner_id === me; }, [t, me]);
  const isDropped = !!t?.dropped_at || statusLower === "dropped";
  const isPublic = useMemo(() => {
    if (!t) return false;
    if (typeof t.is_public === "boolean") return t.is_public === true;
    return isPublicByStatus(t.status);
  }, [t]);

  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${id}` : `https://lockpoint.app/t/${id}`;

  async function load() {
    if (!id) return;
    setLoading(true);
    setToast(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMe(uid);

      const { data: traj, error: tErr } = await supabase
        .from("trajectories")
        .select("id,owner_id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at,lock_reason,stake_amount,stake_currency,is_public")
        .eq("id", id)
        .single();

      if (tErr) throw tErr;

      const status = String(traj?.status ?? "").toLowerCase();
      const ownerOk = !!uid && !!traj?.owner_id && traj.owner_id === uid;
      const dropped = !!traj?.dropped_at || status === "dropped";

      if (ownerOk && status === "draft") { router.replace("/me"); return; }
      if (status === "draft" && !ownerOk) { setT(null); setAmends([]); setToast("This commitment has not been locked yet."); return; }
      if (dropped && !ownerOk) { setT(null); setAmends([]); setToast("Private record."); return; }

      const hasIsPublicCol = Object.prototype.hasOwnProperty.call(traj ?? {}, "is_public");
      const allowedByPublic = hasIsPublicCol ? (traj as any).is_public === true : isPublicByStatus(status);
      if (!ownerOk && !allowedByPublic) { setT(null); setAmends([]); setToast("Private record."); return; }

      setT(traj as Trajectory);

      const { data: a, error: aErr } = await supabase
        .from("trajectory_amendments")
        .select("id,trajectory_id,kind,content,created_at")
        .eq("trajectory_id", id)
        .order("created_at", { ascending: false });

      if (aErr) throw aErr;
      setAmends((a ?? []) as Amendment[]);
    } catch (e: any) {
      console.error(e);
      setT(null);
      setAmends([]);
      setToast(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t?.title ?? "Commitment"}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Locked permanently. Only outcomes appended.
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/" className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
              Home
            </Link>
            <Link href="/me" className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
              My commitments
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
        ) : !t ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
            {toast ?? "Not found."}
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                id: <span className="font-mono break-all">{t.id}</span> · status{" "}
                <span className="uppercase">{statusLower === "failed" ? "dropped" : t.status}</span>
                {isOwner ? " · owner" : null}
                {isDropped ? " · dropped" : null}
              </div>

              <div className="mt-2 text-xl font-semibold break-words">{t.title}</div>

              {t.commitment ? (
                <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <span className="font-semibold">Commitment:</span> {t.commitment}
                </div>
              ) : null}

              <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                created {fmtDate(t.created_at)}
                {t.deadline_at ? <> · deadline {fmtDate(t.deadline_at)}</> : null}
                {t.locked_at ? <> · locked {fmtDate(t.locked_at)}</> : null}
                {t.dropped_at ? <> · dropped {fmtDate(t.dropped_at)}</> : null}
              </div>

              {t.lock_reason ? (
                <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold">Lock reason:</span> {t.lock_reason}
                </div>
              ) : null}

              {t.stake_amount != null ? (
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold">Stake:</span>{" "}
                  ${t.stake_amount} {t.stake_currency ?? "USD"}
                  <span className="ml-2 text-zinc-400">— self-declared, not enforced</span>
                </div>
              ) : null}

              <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                {isPublic
                  ? "Locked permanently. This record cannot be edited or deleted."
                  : "Private draft."}
              </div>
            </div>

            {isPublic && (
              <ShareBar url={pageUrl} title={t.title} />
            )}

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold">Amendments</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Immutable log (newest first).</div>

              <div className="mt-4 space-y-2">
                {amends.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">No amendments yet.</div>
                ) : (
                  amends.map((a) => (
                    <div key={a.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/20">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="uppercase">{a.kind}</span> · {fmtDate(a.created_at)}
                      </div>
                      <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{a.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {toast ? (
              <div className="mt-6 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                {toast}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
