"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Trajectory = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
  locked_at?: string | null;
};

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Lock modal state
  const [lockOpen, setLockOpen] = useState(false);
  const [lockId, setLockId] = useState<string | null>(null);

  // Lock ritual inputs
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const canLock = useMemo(() => confirmText.trim().toUpperCase() === "LOCK", [confirmText]);

  async function loadLatest() {
    setLoadingList(true);

    const { data, error } = await supabase
      .from("trajectories")
      .select("id,title,status,created_at,locked_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error(error);
      setToast("Error loading list: " + error.message);
      setItems([]);
      setLoadingList(false);
      return;
    }

    setItems((data ?? []) as Trajectory[]);
    setLoadingList(false);
  }

  useEffect(() => {
    loadLatest();
  }, []);

  async function createTrajectory() {
    setBusy(true);
    setToast(null);

    const { data, error } = await supabase
      .from("trajectories")
      .insert({ title: "My first lockpoint", summary: "Draft" })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setToast("Create error: " + error.message);
      setBusy(false);
      return;
    }

    setToast(`Trajectory created: ${shortId(data.id)}`);
    await loadLatest();
    setBusy(false);
  }

  async function lockTrajectory(id: string) {
    setToast(null);

    const { error } = await supabase
      .from("trajectories")
      .update({
        status: "locked",
        locked_at: new Date().toISOString(),
        lock_reason: reason || null,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast("Lock error: " + error.message);
      return;
    }

    setToast("LOCKED · irreversible");
    setLockOpen(false);
    setLockId(null);
    setReason("");
    setConfirmText("");
    await loadLatest();
  }

  const SYSTEM_FORMULA = (
    <>
      Lockpoint doesn’t guide execution. It records <strong>commitment</strong> and{" "}
      <strong>outcome</strong>.
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-24">
        {/* removed MVP badge */}

        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          Lockpoint
        </h1>

        <p className="mt-3 text-lg leading-8 text-zinc-700 dark:text-zinc-200">
          <strong>Where decisions become irreversible futures.</strong>
        </p>

        <p className="mt-6 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          Create a draft trajectory. When you reach the lockpoint, you lock it.
          After lock: <strong>no edits</strong>, <strong>no deletes</strong> —{" "}
          <strong>amendments only</strong>.
        </p>

        <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
          {SYSTEM_FORMULA}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={busy}
            onClick={createTrajectory}
            className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {busy ? "Creating..." : "Create a Trajectory"}
          </button>

          {toast && (
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              {toast}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Latest trajectories</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Drafts exist to be thought through. Locked items are immutable.
          </div>

          <div className="mt-4 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                No trajectories yet.
              </div>
            ) : (
              items.map((t) => {
                const isLocked =
                  (t.status ?? "").toLowerCase() === "locked" || !!t.locked_at;

                return (
                  <div
                    key={t.id}
                    className={[
                      "rounded-xl border px-3 py-2",
                      isLocked
                        ? "border-zinc-300 bg-zinc-50 dark:border-white/15 dark:bg-white/5"
                        : "border-zinc-200 bg-white dark:border-white/10 dark:bg-black/20",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>

                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="font-mono">{shortId(t.id)}</span>
                          {" · "}
                          <span
                            className={[
                              "uppercase tracking-wide",
                              isLocked ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-300",
                            ].join(" ")}
                          >
                            {isLocked ? "LOCKED" : "DRAFT"}
                          </span>
                          {" · "}
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {new Date(t.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {isLocked ? (
                          <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                            Irreversible
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                            onClick={() => {
                              setLockId(t.id);
                              setLockOpen(true);
                              setReason("");
                              setConfirmText("");
                            }}
                          >
                            LOCK THIS
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
          {SYSTEM_FORMULA}
        </div>

        {lockOpen && lockId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-black">
              <div className="text-lg font-semibold">You are at the lockpoint.</div>

              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Once locked:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>No edits</li>
                  <li>No deletions</li>
                  <li>Only amendments will be recorded</li>
                  <li>The original commitment remains forever</li>
                </ul>

                <div className="mt-3">{SYSTEM_FORMULA}</div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  Lock reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  rows={3}
                  placeholder="Why is this the point of no return?"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  Type <span className="font-mono">LOCK</span> to proceed
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-mono outline-none dark:border-white/10 dark:bg-white/5"
                  placeholder="LOCK"
                />
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  disabled={!canLock}
                  className="h-11 w-full rounded-full bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  onClick={() => lockTrajectory(lockId)}
                >
                  LOCK (irreversible)
                </button>
              </div>

              {/* No Cancel button. Closing requires clicking outside or Esc. */}
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Closing this window does not change anything. Locking does.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
