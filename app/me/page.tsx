"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

type Trajectory = {
  id: string;
  title: string;
  commitment?: string | null;
  status: string | null;
  created_at: string;
  locked_at?: string | null;
  dropped_at?: string | null;
  deadline_at?: string | null;
};

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function MyCabinetPage() {
  const [items, setItems] = useState<Trajectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "locked" | "final">("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((t) => {
      const status = (t.status ?? "").toLowerCase();

      const matchFilter =
        filter === "all"
          ? true
          : filter === "draft"
          ? status === "draft"
          : filter === "locked"
          ? status === "locked"
          : // final
            status === "completed" || status === "failed";

      const matchQuery = !query
        ? true
        : `${t.title ?? ""} ${t.commitment ?? ""}`.toLowerCase().includes(query);

      return matchFilter && matchQuery;
    });
  }, [items, q, filter]);

  async function loadMine() {
    setLoading(true);
    setToast(null);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;

    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("trajectories")
      .select("id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      setToast("Load error: " + error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as Trajectory[]);
    setLoading(false);
  }

  useEffect(() => {
    loadMine();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadMine());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">My cabinet</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Your drafts + your locked records. Public registry stays on the home page.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              ← Home
            </Link>
          </div>

          {/* controls */}
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your commitments…"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              />

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="h-10 w-full sm:w-56 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              >
                <option value="all">All</option>
                <option value="draft">Drafts</option>
                <option value="locked">Locked</option>
                <option value="final">Final (Completed/Failed)</option>
              </select>
            </div>

            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Showing {filtered.length} of {items.length}.
            </div>
          </div>

          {/* list */}
          <div className="mt-6 space-y-2">
            {loading ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                No records found.
              </div>
            ) : (
              filtered.map((t) => {
                const status = (t.status ?? "").toLowerCase();
                const isLocked = status === "locked" || !!t.locked_at;
                const isFinal = status === "completed" || status === "failed";

                return (
                  <div
                    key={t.id}
                    className={[
                      "rounded-xl border px-3 py-3",
                      isFinal
                        ? "border-zinc-300 bg-zinc-50 dark:border-white/15 dark:bg-white/5"
                        : isLocked
                        ? "border-zinc-300 bg-zinc-50 dark:border-white/15 dark:bg-white/5"
                        : "border-zinc-200 bg-white dark:border-white/10 dark:bg-black/20",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{t.title}</div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="font-mono">{shortId(t.id)}</span>
                          {" · "}
                          <span className="uppercase tracking-wide">{status || "—"}</span>
                          {" · "}
                          <span className="text-zinc-500 dark:text-zinc-400">
                            created {fmtDate(t.created_at)}
                          </span>
                          {t.deadline_at ? (
                            <>
                              {" · "}
                              <span className="text-zinc-500 dark:text-zinc-400">
                                deadline {fmtDate(t.deadline_at)}
                              </span>
                            </>
                          ) : null}
                          {t.locked_at ? (
                            <>
                              {" · "}
                              <span className="text-zinc-500 dark:text-zinc-400">
                                locked {fmtDate(t.locked_at)}
                              </span>
                            </>
                          ) : null}
                          {t.dropped_at ? (
                            <>
                              {" · "}
                              <span className="text-zinc-600 dark:text-zinc-300">
                                DROPPED {fmtDate(t.dropped_at)}
                              </span>
                            </>
                          ) : null}
                        </div>

                        {t.commitment ? (
                          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                            <span className="font-medium text-zinc-700 dark:text-zinc-200">
                              commitment:
                            </span>{" "}
                            {t.commitment}
                          </div>
                        ) : null}
                      </div>

                      {/* link to detail later */}
                      <Link
                        href={`/t/${t.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        title="Open (detail page next step)"
                      >
                        Open
                      </Link>
                    </div>

                    {isFinal ? (
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Finalized (Completed/Failed). Immutable.
                      </div>
                    ) : isLocked ? (
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Locked. Amendments only.
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Draft. You can still change it.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {toast && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              {toast}
            </div>
          )}
        </main>
      </div>
    </AuthGate>
  );
}
