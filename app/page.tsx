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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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

  // Beta stake (symbolic, no charging yet)
  const [stakePreset, setStakePreset] = useState<number | null>(null);
  const [stakeCustom, setStakeCustom] = useState<string>("");

  const canLock = useMemo(
    () => confirmText.trim().toUpperCase() === "LOCK",
    [confirmText]
  );

  const stakeAmount = useMemo(() => {
    if (stakePreset != null) return stakePreset;
    const n = Number(String(stakeCustom).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }, [stakePreset, stakeCustom]);

  const stakeLabel = useMemo(() => {
    if (!stakeAmount) return null;
    return `$${stakeAmount}`;
  }, [stakeAmount]);

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

  // ESC to close lock modal
  useEffect(() => {
    if (!lockOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLockOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockOpen]);

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

    setToast(`Draft created: ${shortId(data.id)}`);
    await loadLatest();
    setBusy(false);
  }

  async function lockTrajectory(id: string) {
    setToast(null);

    // Persist stake in lock_reason (DB-safe: no schema changes required)
    const stakeLine = stakeLabel ? `\n\n— BETA STAKE (symbolic): ${stakeLabel}` : "";
    const reasonFinal = (reason || "").trim() + stakeLine;
    const lockReason = reasonFinal.trim().length ? reasonFinal : null;

    const { error } = await supabase
      .from("trajectories")
      .update({
        status: "locked",
        locked_at: new Date().toISOString(),
        lock_reason: lockReason,
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
    setStakePreset(null);
    setStakeCustom("");

    await loadLatest();
  }

  const SYSTEM_FORMULA = (
    <>
      Lockpoint doesn’t guide execution.
      <br />
      It records <strong>commitment</strong> and <strong>outcome</strong>.
    </>
  );

  const EXAMPLES = [
    "Delete all social media accounts for 12 months",
    "Run a marathon before Oct 2026",
    "Launch a product and reach €100k revenue",
    "Stop alcohol for 180 days",
    "Publish a book within 90 days",
    "Move to a different country and rebuild from zero",
  ];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-24">
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

        {/* Formula as a “rule of the space” */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex gap-4">
            <div className="w-1 rounded-full bg-zinc-900 dark:bg-white" />
            <div>
              <div className="text-xl font-semibold leading-snug tracking-tight">
                {SYSTEM_FORMULA}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Lockpoint is a registry. Not a coach. Not a tracker. Not a promise machine.
              </div>
            </div>
          </div>
        </div>

        {/* Examples (prецеденти, не “features”) */}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Examples of locked trajectories</div>
          <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            {EXAMPLES.map((x) => (
              <div key={x} className="flex gap-3">
                <span className="select-none font-mono text-zinc-400 dark:text-zinc-500">
                  —
                </span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={busy}
            onClick={createTrajectory}
            className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {busy ? "Creating…" : "Create draft"}
          </button>

          {toast && (
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              {toast}
            </div>
          )}
        </div>

        {/* Registry */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Registry</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Drafts are editable. Locked records are permanent.
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
                          <span className="uppercase tracking-wide">
                            {isLocked ? "LOCKED" : "DRAFT"}
                          </span>
                          {" · "}
                          <span className="text-zinc-500 dark:text-zinc-400">
                            created {fmtDate(t.created_at)}
                          </span>
                          {isLocked && t.locked_at ? (
                            <>
                              {" · "}
                              <span className="text-zinc-500 dark:text-zinc-400">
                                locked {fmtDate(t.locked_at)}
                              </span>
                            </>
                          ) : null}
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
                              setStakePreset(null);
                              setStakeCustom("");
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

        {/* Lock modal (threshold / ritual) */}
        {lockOpen && lockId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onMouseDown={() => setLockOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-black"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">You are at the lockpoint.</div>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    Once locked:
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>No edits</li>
                      <li>No deletions</li>
                      <li>Only amendments will be recorded</li>
                      <li>The original commitment remains forever</li>
                    </ul>

                    <div className="mt-3 text-sm">{SYSTEM_FORMULA}</div>
                  </div>
                </div>

                {/* No Cancel — only closing the window BEFORE lock */}
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                  onClick={() => setLockOpen(false)}
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                You haven’t locked anything yet.
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

              {/* Beta stake (symbolic, no charging) */}
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Optional stake (beta)
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  This does not improve outcomes. It increases commitment weight.
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                    During beta, stakes are symbolic and not charged.
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[10, 25, 50].map((amt) => {
                    const active = stakePreset === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setStakePreset(active ? null : amt);
                          setStakeCustom("");
                        }}
                        className={[
                          "h-9 rounded-full border px-4 text-xs font-medium transition",
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/10",
                        ].join(" ")}
                      >
                        ${amt}
                      </button>
                    );
                  })}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Custom:
                    </span>
                    <input
                      value={stakeCustom}
                      onChange={(e) => {
                        setStakeCustom(e.target.value);
                        setStakePreset(null);
                      }}
                      className="h-9 w-28 rounded-full border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-black/20"
                      placeholder="$"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                {stakeLabel ? (
                  <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                    Selected stake: <span className="font-mono">{stakeLabel}</span>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    No stake attached.
                  </div>
                )}
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

              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Closing this window changes nothing. Locking does.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
