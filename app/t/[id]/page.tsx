"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Trajectory = {
  id: string;
  owner_id: string | null;
  title: string;
  commitment: string | null;
  status: string | null; // draft | locked | completed | failed | ...
  created_at: string;
  locked_at?: string | null;
  dropped_at?: string | null;
  deadline_at?: string | null;
  lock_reason?: string | null;
  stake_amount?: number | null;
  stake_currency?: string | null;
  is_public?: boolean | null; // may be absent in some DB versions
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
  const s = String(status ?? "").toLowerCase();
  return s === "locked" || s === "completed" || s === "failed";
}

export default function TrajectoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter(); 
  const [me, setMe] = useState<string | null>(null);
  const [t, setT] = useState<Trajectory | null>(null);
  const [amends, setAmends] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const statusLower = useMemo(() => String(t?.status ?? "").toLowerCase(), [t?.status]);
  const isOwner = useMemo(() => !!t && !!me && t.owner_id === me, [t, me]);
  const isDraft = statusLower === "draft";
  const isDropped = !!t?.dropped_at || statusLower === "dropped";

  const isPublic = useMemo(() => {
    if (!t) return false;
    // Prefer is_public if present and boolean
    if (typeof (t as any).is_public === "boolean") return (t as any).is_public === true;
    return isPublicByStatus(t.status);
  }, [t]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!id) return "";
    return `${window.location.origin}/t/${id}`;
  }, [id]);

  async function shareRecord() {
    if (!shareUrl || !t) return;
    setToast(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: t?.title ? `Lockpoint — ${t.title}` : "Lockpoint record",
          text: t?.commitment
            ? `Locked record: ${t.title}\n\n${t.commitment}`
            : `Locked record: ${t?.title ?? "Record"}`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setToast("Link copied.");
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setToast("Link copied.");
      } catch {
        setToast("Could not share/copy link.");
      }
    }
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setToast(null);

    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMe(uid);

      // Load trajectory
      const { data: traj, error: tErr } = await supabase
        .from("trajectories")
        .select(
          "id,owner_id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at,lock_reason,stake_amount,stake_currency,is_public"
        )
        .eq("id", id)
        .single();

      if (tErr) throw tErr;

const status = String((traj as any)?.status ?? "").toLowerCase();
const ownerOk = !!uid && !!(traj as any)?.owner_id && (traj as any).owner_id === uid;

// ✅ owner draft should live in /me
if (ownerOk && status === "draft") {
  router.replace("/me");
  return;
}

const dropped = !!(traj as any)?.dropped_at || status === "dropped";

// Privacy:
if (status === "draft" && !ownerOk) {
  setT(null);
  setAmends([]);
  setToast("Private draft. Sign in as the owner to view.");
  return;
}
      }
      if (dropped && !ownerOk) {
        setT(null);
        setAmends([]);
        setToast("Private record.");
        return;
      }

      const hasIsPublicCol = Object.prototype.hasOwnProperty.call(traj ?? {}, "is_public");
      const allowedByPublic = hasIsPublicCol ? (traj as any).is_public === true : isPublicByStatus(status);

      if (!ownerOk && !allowedByPublic) {
        setT(null);
        setAmends([]);
        setToast("Private record.");
        return;
      }

      setT(traj as Trajectory);

      // Load amendments
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Record</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Immutable view + amendment log.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Home
            </Link>
            <Link
              href="/me"
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              My cabinet
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
            {/* MAIN CARD */}
            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    id: <span className="font-mono break-all">{t.id}</span>
                    {" · "}
                    status: <span className="uppercase">{t.status ?? "—"}</span>
                    {isOwner ? (
                      <>
                        {" · "}
                        <span className="text-zinc-500 dark:text-zinc-400">owner view</span>
                      </>
                    ) : null}
                    {isDraft ? (
                      <>
                        {" · "}
                        <span className="text-zinc-500 dark:text-zinc-400">draft</span>
                      </>
                    ) : null}
                    {isDropped ? (
                      <>
                        {" · "}
                        <span className="text-zinc-500 dark:text-zinc-400">dropped</span>
                      </>
                    ) : null}
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
                      <span className="font-semibold">Stake:</span> {t.stake_currency ?? "USD"}{" "}
                      {t.stake_amount} <span className="text-zinc-500">(beta)</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2">
                  {isPublic ? (
                    <>
                      <button
                        type="button"
                        onClick={shareRecord}
                        className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      >
                        Share
                      </button>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Public record.</div>
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Private record.</div>
                  )}

                  {toast ? (
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                      {toast}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Guidance */}
              {isOwner && (isDraft || isDropped) ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                  Actions (LOCK / AMEND / OUTCOME) are available in <span className="font-mono">/me</span>.
                </div>
              ) : null}
            </div>

            {/* AMENDMENTS LIST */}
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold">Amendments</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Immutable log (newest first).</div>

              <div className="mt-4 space-y-2">
                {amends.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">No amendments yet.</div>
                ) : (
                  amends.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/20"
                    >
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="uppercase">{a.kind}</span> · {fmtDate(a.created_at)}
                      </div>
                      <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{a.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
