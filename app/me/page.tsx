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

type AmendmentKind = "MILESTONE" | "OUTCOME" | "NOTE" | "DROP";

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

  // --- Lock modal state ---
  const [lockOpen, setLockOpen] = useState(false);
  const [lockId, setLockId] = useState<string | null>(null);
  const [lockCoreTitle, setLockCoreTitle] = useState("");
  const [lockCoreCommitment, setLockCoreCommitment] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [lockConfirm, setLockConfirm] = useState("");
  const [lockLoading, setLockLoading] = useState(false);

  // stake
  const [stakePreset, setStakePreset] = useState<number | null>(null);
  const [stakeCustom, setStakeCustom] = useState<string>("");

  // --- Amendment / Outcome modal ---
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendTrajectoryId, setAmendTrajectoryId] = useState<string | null>(null);
  const [amendKind, setAmendKind] = useState<AmendmentKind>("MILESTONE");
  const [amendBody, setAmendBody] = useState("");
  const [amendConfirm, setAmendConfirm] = useState("");
  const [outcomeResult, setOutcomeResult] = useState<"COMPLETED" | "FAILED">("COMPLETED");

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
          : status === "completed" || status === "failed";

      const matchQuery = !query
        ? true
        : `${t.title ?? ""} ${t.commitment ?? ""}`.toLowerCase().includes(query);

      return matchFilter && matchQuery;
    });
  }, [items, q, filter]);

  const lockCoreOk = useMemo(() => {
    const t = lockCoreTitle.trim();
    const c = lockCoreCommitment.trim();
    return t.length >= 3 && c.length >= 8;
  }, [lockCoreTitle, lockCoreCommitment]);

  const canLockTyped = useMemo(() => lockConfirm.trim().toUpperCase() === "LOCK", [lockConfirm]);
  const canLock = lockCoreOk && canLockTyped;

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

  const canAmend = useMemo(() => {
    const okWord = amendConfirm.trim().toUpperCase() === "AMEND";
    const len = amendBody.trim().length;
    const minLen = amendKind === "DROP" ? 1 : amendKind === "NOTE" ? 1 : 5;
    return okWord && len >= minLen;
  }, [amendConfirm, amendBody, amendKind]);

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
      .limit(80);

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

  // ESC close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!lockLoading) setLockOpen(false);
        setAmendOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockLoading]);

  function openLockModal(t: Trajectory) {
    setToast(null);
    setLockId(t.id);
    setLockOpen(true);
    setLockLoading(false);

    setLockCoreTitle(t.title ?? "");
    setLockCoreCommitment(t.commitment ?? "");
    setLockReason("");
    setLockConfirm("");

    setStakePreset(null);
    setStakeCustom("");
  }

  async function lockTrajectory() {
    if (!lockId) return;
    if (lockLoading) return;

    setLockLoading(true);
    setToast(null);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setToast("Please sign in.");
      setLockLoading(false);
      return;
    }

    const title = lockCoreTitle.trim();
    const commitment = lockCoreCommitment.trim();

    if (title.length < 3 || commitment.length < 8) {
      setToast("Lock requires a title (≥3) and a commitment statement (≥8).");
      setLockLoading(false);
      return;
    }
    if (lockConfirm.trim().toUpperCase() !== "LOCK") {
      setToast('Type "LOCK" to proceed.');
      setLockLoading(false);
      return;
    }

    const payload: Record<string, any> = {
      title,
      commitment,
      status: "locked",
      locked_at: new Date().toISOString(),
      stake_amount: stakeAmount ?? null,
      stake_currency: stakeAmount ? "USD" : null,
      lock_reason: lockReason?.trim() ? lockReason.trim() : null,
    };

    const { error } = await supabase
      .from("trajectories")
      .update(payload)
      .eq("id", lockId)
      .eq("owner_id", uid)
      .eq("status", "draft");

    if (error) {
      console.error(error);
      setToast("Lock error: " + error.message);
      setLockLoading(false);
      return;
    }

    setToast("LOCKED · irreversible");
    setLockOpen(false);
    setLockId(null);
    setLockLoading(false);

    await loadMine();
  }

  async function dropDraft(id: string) {
    setToast(null);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setToast("Please sign in.");
      return;
    }

    const { error } = await supabase
      .from("trajectories")
      .update({ dropped_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", uid)
      .eq("status", "draft");

    if (error) {
      console.error(error);
      setToast("Drop error: " + error.message);
      return;
    }

    setToast("DROPPED");
    await loadMine();
  }

  function openAmendModal(t: Trajectory, kind: AmendmentKind = "MILESTONE") {
    setToast(null);
    setAmendTrajectoryId(t.id);
    setAmendKind(kind);
    setAmendBody("");
    setAmendConfirm("");
    if (kind === "OUTCOME") setOutcomeResult("COMPLETED");
    setAmendOpen(true);
  }

  async function addAmendment() {
    if (!amendTrajectoryId) return;

    setToast(null);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setToast("Please sign in.");
      return;
    }

    const contentRaw = amendBody.trim();

    const minLen = amendKind === "DROP" ? 1 : amendKind === "NOTE" ? 1 : 5;
    if (contentRaw.length < minLen) {
      setToast("Text is too short.");
      return;
    }
    if (amendConfirm.trim().toUpperCase() !== "AMEND") {
      setToast('Type "AMEND" to proceed.');
      return;
    }

    // Outcome finalizes trajectory status (only for locked)
    if (amendKind === "OUTCOME") {
      const finalStatus = outcomeResult === "COMPLETED" ? "completed" : "failed";

      const { error: outErr } = await supabase
        .from("trajectories")
        .update({ status: finalStatus })
        .eq("id", amendTrajectoryId)
        .eq("owner_id", uid)
        .eq("status", "locked");

      if (outErr) {
        console.error(outErr);
        setToast("Outcome error: " + outErr.message);
        return;
      }
    }

    const content = amendKind === "OUTCOME" ? `[${outcomeResult}] ${contentRaw}` : contentRaw;

    // Insert amendment record
    const { error } = await supabase.from("trajectory_amendments").insert({
      trajectory_id: amendTrajectoryId,
      kind: amendKind,
      content,
    });

    if (error) {
      console.error(error);
      setToast("Amendment error: " + error.message);
      return;
    }

    // DROP: mark dropped_at only if draft
    if (amendKind === "DROP") {
      const { error: dropErr } = await supabase
        .from("trajectories")
        .update({ dropped_at: new Date().toISOString() })
        .eq("id", amendTrajectoryId)
        .eq("owner_id", uid)
        .eq("status", "draft");

      if (dropErr) console.warn("dropped_at update warn:", dropErr.message);
    }

    setToast(`${amendKind} recorded`);
    setAmendOpen(false);
    setAmendTrajectoryId(null);
    setAmendBody("");
    setAmendConfirm("");

    await loadMine();
  }

  const SYSTEM_FORMULA = (
    <>
      Lockpoint doesn’t guide execution.
      <br />
      It records <strong>commitment</strong> and <strong>outcome</strong>.
    </>
  );

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">My cabinet</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Drafts live here. Locking and outcomes happen here. Public registry stays on home.
              </p>
              <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                {SYSTEM_FORMULA}
              </div>
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
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No records found.</div>
            ) : (
              filtered.map((t) => {
                const status = (t.status ?? "").toLowerCase();
                const isLocked = status === "locked" || !!t.locked_at;
                const isFinal = status === "completed" || status === "failed";
                const isDraft = status === "draft";

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

                      <div className="flex flex-col items-end gap-2">
                        <Link
                          href={`/t/${t.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                          title="Open immutable view"
                        >
                          Open
                        </Link>

                        {isDraft ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openLockModal(t)}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              title="Lock this draft (irreversible)"
                            >
                              LOCK
                            </button>

                            <button
                              type="button"
                              onClick={() => openAmendModal(t, "DROP")}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              title="Drop draft"
                            >
                              DROP
                            </button>
                          </div>
                        ) : isLocked && !isFinal ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openAmendModal(t, "MILESTONE")}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              title="Add amendment"
                            >
                              AMEND
                            </button>

                            <button
                              type="button"
                              onClick={() => openAmendModal(t, "OUTCOME")}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              title="Record outcome (finalizes forever)"
                            >
                              OUTCOME
                            </button>
                          </div>
                        ) : (
                          <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                            {isFinal ? "Final" : "—"}
                          </span>
                        )}
                      </div>
                    </div>

                    {isFinal ? (
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Finalized (Completed/Failed). Immutable.
                      </div>
                    ) : isLocked ? (
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Locked. Amendments only. Outcome finalizes it.
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Draft. You can still change it, lock it, or drop it.
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

        {/* LOCK MODAL */}
        {lockOpen && lockId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onMouseDown={() => !lockLoading && setLockOpen(false)}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-black flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex-1 overflow-y-auto p-5">
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

                  <button
                    type="button"
                    disabled={lockLoading}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() => setLockOpen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* core */}
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    Commitment core (required)
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    A locked record must have a title and a commitment statement.
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      Title
                    </label>
                    <input
                      value={lockCoreTitle}
                      onChange={(e) => setLockCoreTitle(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                      placeholder="Title"
                    />
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      Commitment statement
                    </label>
                    <textarea
                      value={lockCoreCommitment}
                      onChange={(e) => setLockCoreCommitment(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                      rows={3}
                      placeholder='One sentence. Example: "I will … by …"'
                    />
                  </div>

                  {!lockCoreOk ? (
                    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Minimum: title ≥ 3 chars, statement ≥ 8 chars.
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                      Core is valid.
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    Lock reason (optional)
                  </label>
                  <textarea
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                    rows={3}
                    placeholder="Why is this the point of no return?"
                  />
                </div>

                {/* stake */}
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    Optional stake (beta)
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    This does not buy success. It increases the weight of the decision.
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
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Custom:</span>
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

                  <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {stakeLabel ? (
                      <>
                        Selected stake: <span className="font-mono">{stakeLabel}</span>
                      </>
                    ) : (
                      "No stake attached."
                    )}
                  </div>
                </div>

                <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  Closing this window changes nothing. Locking does.
                </div>
              </div>

              {/* footer */}
              <div className="border-t border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-black">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  Type <span className="font-mono">LOCK</span> to proceed
                </label>

                <input
                  value={lockConfirm}
                  onChange={(e) => setLockConfirm(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-mono outline-none dark:border-white/10 dark:bg-white/5"
                  placeholder="LOCK"
                />

                <button
                  type="button"
                  disabled={!canLock || lockLoading}
                  className={[
                    "mt-3 h-11 w-full rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                    canLock && !lockLoading
                      ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      : "bg-zinc-300 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
                  ].join(" ")}
                  onClick={lockTrajectory}
                >
                  {lockLoading ? "Locking…" : "LOCK — irreversible"}
                </button>

                {toast && (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                    {toast}
                  </div>
                )}

                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Current time will be recorded.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AMEND / OUTCOME MODAL */}
        {amendOpen && amendTrajectoryId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onMouseDown={() => setAmendOpen(false)}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-black flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Add amendment</div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Amendments are immutable. They extend the record.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() => setAmendOpen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Type</label>
                  <select
                    value={amendKind}
                    onChange={(e) => {
                      const k = e.target.value as AmendmentKind;
                      setAmendKind(k);
                      if (k === "OUTCOME") setOutcomeResult("COMPLETED");
                    }}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  >
                    <option value="MILESTONE">AMEND — clarification / milestone</option>
                    <option value="OUTCOME">OUTCOME — final result</option>
                    <option value="NOTE">NOTE — short note</option>
                    <option value="DROP">DROP — discard draft</option>
                  </select>
                </div>

                {amendKind === "OUTCOME" && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      Outcome
                    </label>

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOutcomeResult("COMPLETED")}
                        className={[
                          "h-9 rounded-full border px-4 text-xs font-medium transition",
                          outcomeResult === "COMPLETED"
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/10",
                        ].join(" ")}
                      >
                        ✅ Completed
                      </button>

                      <button
                        type="button"
                        onClick={() => setOutcomeResult("FAILED")}
                        className={[
                          "h-9 rounded-full border px-4 text-xs font-medium transition",
                          outcomeResult === "FAILED"
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/10",
                        ].join(" ")}
                      >
                        ❌ Failed
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      This will permanently finalize the record.
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Text</label>
                  <textarea
                    value={amendBody}
                    onChange={(e) => setAmendBody(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                    rows={4}
                    placeholder={
                      amendKind === "OUTCOME"
                        ? "Outcome note (facts): what happened. One sentence."
                        : amendKind === "DROP"
                        ? "Why are you dropping this draft? (facts)"
                        : amendKind === "NOTE"
                        ? "Short note"
                        : "What happened? (facts)"
                    }
                  />
                </div>

                <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  Type <span className="font-mono">AMEND</span> to record this.
                </div>

                <div className="mt-2">
                  <input
                    value={amendConfirm}
                    onChange={(e) => setAmendConfirm(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-mono outline-none dark:border-white/10 dark:bg-white/5"
                    placeholder="AMEND"
                  />
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    disabled={!canAmend}
                    className={[
                      "h-11 w-full rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                      canAmend
                        ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        : "bg-zinc-300 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
                    ].join(" ")}
                    onClick={addAmendment}
                  >
                    RECORD
                  </button>
                </div>

                {toast && (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                    {toast}
                  </div>
                )}

                <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Current time will be recorded.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
