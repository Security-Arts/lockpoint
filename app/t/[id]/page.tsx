"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

type Trajectory = {
  id: string;
  owner_id: string | null;
  title: string;
  commitment: string | null;
  status: string | null;
  created_at: string;
  locked_at?: string | null;
  dropped_at?: string | null;
  deadline_at?: string | null;
  lock_reason?: string | null;
  stake_amount?: number | null;
  stake_currency?: string | null;
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
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function TrajectoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<string | null>(null);
  const [t, setT] = useState<Trajectory | null>(null);
  const [amends, setAmends] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!t || !me) return false;
    return t.owner_id === me;
  }, [t, me]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setToast(null);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    setMe(uid);

    const { data: traj, error: tErr } = await supabase
      .from("trajectories")
      .select(
        "id,owner_id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at,lock_reason,stake_amount,stake_currency"
      )
      .eq("id", id)
      .single();

    if (tErr) {
      setToast("Load error: " + tErr.message);
      setT(null);
      setAmends([]);
      setLoading(false);
      return;
    }

    // якщо хочеш, щоб сторінка була ТІЛЬКИ для власника — залишаємо так:
    if (uid && traj?.owner_id && traj.owner_id !== uid) {
      setToast("Forbidden: this record is not yours.");
      setT(null);
      setAmends([]);
      setLoading(false);
      return;
    }

    setT(traj as Trajectory);

    const { data: a, error: aErr } = await supabase
      .from("trajectory_amendments")
      .select("id,trajectory_id,kind,content,created_at")
      .eq("trajectory_id", id)
      .order("created_at", { ascending: false });

    if (aErr) {
      setToast("Amendments error: " + aErr.message);
      setAmends([]);
      setLoading(false);
      return;
    }

    setAmends((a ?? []) as Amendment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-3xl px-6 py-14">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Trajectory</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Detail view + immutable amendment log.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/me"
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                ← My cabinet
              </Link>
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Home
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
                  id: <span className="font-mono">{t.id}</span>
                  {" · "}
                  status: <span className="uppercase">{t.status ?? "—"}</span>
                </div>

                <div className="mt-2 text-xl font-semibold">{t.title}</div>

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

                {t.stake_amount ? (
                  <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold">Stake:</span> {t.stake_currency ?? "USD"}{" "}
                    {t.stake_amount}
                  </div>
                ) : null}

                {!isOwner ? (
                  <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                    (Owner-only view enabled.)
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold">Amendments</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Immutable log (newest first).
                </div>

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
                        <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                          {a.content}
                        </div>
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
    </AuthGate>
  );
}
