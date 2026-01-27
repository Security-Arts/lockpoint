"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

type Trajectory = {
  id: string;
  owner_id: string | null;
  title: string;
  commitment?: string | null;
  status: string | null;
  created_at: string;
  locked_at?: string | null;
  dropped_at?: string | null;
  deadline_at?: string | null;
  is_public: boolean; // ✅ truth
};

type AmendmentKind = "MILESTONE" | "OUTCOME" | "NOTE"; // ✅ DROP removed (UI action)
type OutcomeResult = "COMPLETED" | "FAILED";

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

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

function norm(s?: string | null) {
  return String(s ?? "").toLowerCase();
}

export default function MyCabinetPage() {
  const [items, setItems] = useState<Trajectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "locked" | "final">("all");

  // Lock modal
  const [lockOpen, setLockOpen] = useState(false);
  const [lockId, setLockId] = useState<string | null>(null);
  const [lockCoreTitle, setLockCoreTitle] = useState("");
  const [lockCoreCommitment, setLockCoreCommitment] = useState("");
  const [deadline, setDeadline] = useState<string>(""); // YYYY-MM-DD
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [lockLoading, setLockLoading] = useState(false);

  const [stakePreset, setStakePreset] = useState<number | null>(null);
  const [stakeCustom, setStakeCustom] = useState<string>("");

  // ✅ public toggle
  const [makePublic, setMakePublic] = useState<boolean>(false);

  // Amend modal
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendTrajectoryId, setAmendTrajectoryId] = useState<string | null>(null);
  const [amendTrajectoryStatus, setAmendTrajectoryStatus] = useState<string>(""); // ✅ to restrict options
  const [amendKind, setAmendKind] = useState<AmendmentKind>("MILESTONE");
  const [amendBody, setAmendBody] = useState("");
  const [amendConfirm, setAmendConfirm] = useState("");
  const [outcomeResult, setOutcomeResult] = useState<OutcomeResult>("COMPLETED");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((t) => {
      const status = norm(t.status);
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

  const canLockTyped = useMemo(() => confirmText.trim().toUpperCase() === "LOCK", [confirmText]);

  const stakeAmount = useMemo(() => {
    if (stakePreset != null) return stakePreset;
    const n = Number(String(stakeCustom).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }, [stakePreset, stakeCustom]);

  const canLock = lockCoreOk && canLockTyped;

  const amendMinLen = useMemo(() => {
    if (amendKind === "NOTE") return 3;
    return 5; // MILESTONE | OUTCOME
  }, [amendKind]);

  const canAmend = useMemo(() => {
    const okWord = amendConfirm.trim().toUpperCase() === "AMEND";
    const len = amendBody.trim().length;
    return okWord && len >= amendMinLen;
  }, [amendConfirm, amendBody, amendMinLen]);

  async function loadMine() {
    setLoading(true);
    setToast(null);

    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const uid = u.user?.id;
      if (!uid) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from("trajectories")
        .select("id,owner_id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at,is_public")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(120);

      if (error) throw error;

      setItems((data ?? []) as Trajectory[]);
    } catch (e: any) {
      console.error("loadMine error:", e);
      setToast(e?.message ?? "Load failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMine();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadMine());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    setReason("");
    setConfirmText("");
    setStakePreset(null);
    setStakeCustom("");

    // ✅ public default from row (draft is normally false; but keep in sync)
    setMakePublic(!!t.is_public);

    // deadline -> input YYYY-MM-DD
    setDeadline(t.deadline_at ? String(t.deadline_at).slice(0, 10) : "");
  }

  async function lockTrajectory() {
    if (!lockId) return;
    if (lockLoading) return;

    setLockLoading(true);
    setToast(null);

    const title = lockCoreTitle.trim();
    const commitment = lockCoreCommitment.trim();

    if (!lockCoreOk) {
      setToast("Lock requires a title (≥3) and a commitment statement (≥8).");
      setLockLoading(false);
      return;
    }
    if (!canLockTyped) {
      setToast('Type "LOCK" to proceed.');
      setLockLoading(false);
      return;
    }

    // ✅ avoid timezone-shift: store at 12:00Z for date-only input
    const deadlineISO = deadline ? `${deadline}T12:00:00.000Z` : null;

const payload = {
  title,
  commitment,
  status: "locked",
  locked_at: new Date().toISOString(),
  deadline_at: deadlineISO,
  stake_amount: stakeAmount ?? null,
  stake_currency: stakeAmount ? "USD" : null,
  lock_reason: reason?.trim() ? reason.trim() : null,
  is_public: true, 
};

    // atomic: only lock if still draft
    const { data: updated, error } = await supabase
      .from("trajectories")
      .update(payload)
      .eq("id", lockId)
      .eq("status", "draft")
      .select("id,status")
      .maybeSingle();

    if (error) {
      console.error(error);
      setToast("Lock error: " + error.message);
      setLockLoading(false);
      return;
    }
    if (!updated) {
      setToast("This record is not a draft anymore.");
      setLockLoading(false);
      return;
    }

    setLockOpen(false);
    setLockId(null);
    setLockLoading(false);
    await loadMine();
  }

  function openAmendModal(t: Trajectory, kind: AmendmentKind) {
    setToast(null);
    setAmendTrajectoryId(t.id);
    setAmendTrajectoryStatus(norm(t.status));
    setAmendKind(kind);
    setAmendBody("");
    setAmendConfirm("");
    setOutcomeResult("COMPLETED");
    setAmendOpen(true);
  }

  async function dropDraft(t: Trajectory) {
    setToast(null);
    const id = t.id;

    const { data: dropped, error: dropErr } = await supabase
      .from("trajectories")
      .update({
        dropped_at: new Date().toISOString(),
        is_public: false, // ✅ always private
      })
      .eq("id", id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();

    if (dropErr) {
      console.error(dropErr);
      setToast("Drop error: " + dropErr.message);
      return;
    }
    if (!dropped) {
      setToast("Only drafts can be dropped.");
      return;
    }

    await loadMine();
  }

  async function addAmendment() {
    if (!amendTrajectoryId) return;

    setToast(null);
    const contentRaw = amendBody.trim();

    // ✅ restrict by current status
    const st = norm(amendTrajectoryStatus);
    if (amendKind === "OUTCOME" && st !== "locked") {
      setToast("Outcome can be recorded only while status is LOCKED.");
      return;
    }
    if (!canAmend) {
      setToast(`Type "AMEND" and provide at least ${amendMinLen} characters.`);
      return;
    }

    // OUTCOME: update status only if currently locked (prevents failed->completed etc)
    if (amendKind === "OUTCOME") {
      const finalStatus = outcomeResult === "COMPLETED" ? "completed" : "failed";

      const { data: updated, error: outErr } = await supabase
        .from("trajectories")
        .update({ status: finalStatus })
        .eq("id", amendTrajectoryId)
        .eq("status", "locked")
        .select("id,status")
        .maybeSingle();

      if (outErr) {
        console.error(outErr);
        setToast("Outcome error: " + outErr.message);
        return;
      }

      if (!updated) {
        setToast("Outcome already recorded (final). It cannot be changed.");
        return;
      }
    }

    const content =
      amendKind === "OUTCOME" ? `[${outcomeResult}] ${contentRaw}` : contentRaw;

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

    setAmendOpen(false);
    setAmendTrajectoryId(null);
    setAmendBody("");
    setAmendConfirm("");
    await loadMine();
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">My cabinet</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Drafts + locked records. Public registry stays on the home page.
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
                <option value="final">Final</option>
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
                const status = norm(t.status);
                const isLocked = status === "locked" || !!t.locked_at;
                const isFinal = status === "completed" || status === "failed";
                const isDraft = status === "draft" && !t.locked_at;
                const isDroppedDraft = isDraft && !!t.dropped_at;

                return (
                  <div
                    key={t.id}
                    className={[
                      "rounded-xl border px-3 py-3",
                      isFinal || isLocked
                        ? "border-zinc-300 bg-zinc-50 dark:border-white/15 dark:bg-white/5"
                        : "border-zinc-200 bg-white dark:border-white/10 dark:bg-black/20",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold truncate">{t.title}</div>
                          {t.is_public ? (
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                              PUBLIC
                            </span>
                          ) : null}
                          {isDroppedDraft ? (
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                              DROPPED
                            </span>
                          ) : null}
                        </div>

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
                                dropped {fmtDate(t.dropped_at)}
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
                          title="Open"
                        >
                          Open
                        </Link>

                        {isDraft && !isDroppedDraft ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                              onClick={() => openLockModal(t)}
                            >
                              LOCK
                            </button>

                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              onClick={() => dropDraft(t)}
                            >
                              DROP
                            </button>
                          </div>
                        ) : isLocked && !isFinal ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              onClick={() => openAmendModal(t, "MILESTONE")}
                            >
                              AMEND
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                              onClick={() => openAmendModal(t, "OUTCOME")}
                            >
                              OUTCOME
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 text-right">
                            {isFinal ? "Finalized." : isDroppedDraft ? "Dropped." : "—"}
                          </div>
                        )}
                      </div>
                    </div>
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
                      Once locked: no edits, no deletes — amendments only.
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={lockLoading}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() => setLockOpen(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-xs font-semibold">Commitment core (required)</div>

                  <div className="mt-3">
                    <label className="text-xs font-medium">Title</label>
                    <input
                      value={lockCoreTitle}
                      onChange={(e) => setLockCoreTitle(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                      placeholder="Title"
                    />
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium">Commitment statement</label>
                    <textarea
                      value={lockCoreCommitment}
                      onChange={(e) => setLockCoreCommitment(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                      rows={3}
                      placeholder='One sentence. Example: "I will … by …"'
                    />
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium">Deadline (optional)</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                    />
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Stored at 12:00Z to avoid timezone shift.
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {lockCoreOk ? "Core is valid." : "Minimum: title ≥ 3 chars, statement ≥ 8 chars."}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-medium">Lock reason (optional)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                    rows={3}
                    placeholder="Why is this the point of no return?"
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-xs font-semibold">Optional stake (beta)</div>
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
                    {stakeAmount ? `Selected stake: $${stakeAmount}` : "No stake attached."}
                  </div>
                </div>

                <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  Closing this window changes nothing. Locking does.
                </div>
              </div>

              <div className="border-t border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-black">
                <label className="text-xs font-medium">
                  Type <span className="font-mono">LOCK</span> to proceed
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
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
              </div>
            </div>
          </div>
        )}

        {/* AMEND MODAL */}
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
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-medium">Type</label>
                  <select
                    value={amendKind}
                    onChange={(e) => {
                      const k = e.target.value as AmendmentKind;
                      setAmendKind(k);
                      setOutcomeResult("COMPLETED");
                    }}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  >
                    <option value="MILESTONE">AMEND — clarification / milestone</option>
                    <option value="NOTE">NOTE — short note</option>
                    <option value="OUTCOME" disabled={norm(amendTrajectoryStatus) !== "locked"}>
                      OUTCOME — final result (locked only)
                    </option>
                  </select>
                  {norm(amendTrajectoryStatus) !== "locked" ? (
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Outcome is available only while status is <span className="font-mono">locked</span>.
                    </div>
                  ) : null}
                </div>

                {amendKind === "OUTCOME" && (
                  <div className="mt-4">
                    <label className="text-xs font-medium">Outcome</label>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOutcomeResult("COMPLETED")}
                        className={[
                          "h-9 rounded-full border px-4 text-xs font-medium transition",
                          outcomeResult === "COMPLETED"
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/10",
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
                            : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/10",
                        ].join(" ")}
                      >
                        ❌ Failed
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Outcome is permanent.
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-xs font-medium">Text</label>
                  <textarea
                    value={amendBody}
                    onChange={(e) => setAmendBody(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                    rows={4}
                    placeholder={amendKind === "OUTCOME" ? "Outcome note (facts). One sentence." : "What happened? (facts)"}
                  />
                  {amendBody.trim().length > 0 && amendBody.trim().length < amendMinLen ? (
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Minimum {amendMinLen} characters
                    </div>
                  ) : null}
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
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
