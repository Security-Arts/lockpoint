"use client";
import { AuthGate } from "@/components/AuthGate";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
type Trajectory = {
  id: string;
  title: string;
  commitment?: string | null;
  status: string | null;
  created_at: string;
  locked_at?: string | null;
  dropped_at?: string | null;
};

type AmendmentKind = "MILESTONE" | "OUTCOME" | "DROP" | "NOTE";

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

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Draft inputs
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCommitment, setDraftCommitment] = useState("");

  // Lock modal state
  const [lockOpen, setLockOpen] = useState(false);
  const [lockId, setLockId] = useState<string | null>(null);
  const [lockCoreTitle, setLockCoreTitle] = useState("");
  const [lockCoreCommitment, setLockCoreCommitment] = useState("");

  // Lock ritual inputs
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  // Lock loading (so button shows “Locking…” and prevents double submit)
  const [lockLoading, setLockLoading] = useState(false);

  // Beta stake (symbolic)
  const [stakePreset, setStakePreset] = useState<number | null>(null);
  const [stakeCustom, setStakeCustom] = useState<string>("");

  // Amendment modal
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendTrajectoryId, setAmendTrajectoryId] = useState<string | null>(null);
  const [amendKind, setAmendKind] = useState<AmendmentKind>("MILESTONE");
  const [amendBody, setAmendBody] = useState("");
  const [amendConfirm, setAmendConfirm] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setAuthReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // ✅ Outcome choice (for OUTCOME kind)
  const [outcomeResult, setOutcomeResult] = useState<"COMPLETED" | "FAILED">("COMPLETED");

  const canLockTyped = useMemo(
    () => confirmText.trim().toUpperCase() === "LOCK",
    [confirmText]
  );

  const lockCoreOk = useMemo(() => {
    const t = lockCoreTitle.trim();
    const c = lockCoreCommitment.trim();
    return t.length >= 3 && c.length >= 8;
  }, [lockCoreTitle, lockCoreCommitment]);

  const canLock = canLockTyped && lockCoreOk;

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

  const minLen = amendKind === "DROP" ? 1 : 5; // ✅ DROP простіше
  return okWord && len >= minLen;
}, [amendConfirm, amendBody, amendKind]);


  // ✅ Create draft validity
  const canCreateDraft = useMemo(() => {
    const t = draftTitle.trim();
    const c = draftCommitment.trim();
    return t.length >= 3 && c.length >= 8;
  }, [draftTitle, draftCommitment]);

  async function loadLatest() {
    setLoadingList(true);

    const { data, error } = await supabase
      .from("trajectories")
      .select("id,title,commitment,status,created_at,locked_at,dropped_at")
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

  // ESC close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLockOpen(false);
        setAmendOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function createTrajectory() {
  if (busy) return;
  setBusy(true);
  setToast(null);

  const title = draftTitle.trim();
  const commitment = draftCommitment.trim();

  // ✅ precise messages
  if (title.length < 3) {
    setToast("Title must be at least 3 characters.");
    setBusy(false);
    return;
  }
  if (commitment.length < 8) {
    setToast("Commitment statement must be at least 8 characters.");
    setBusy(false);
    return;
  }

  // ✅ require auth before creating a draft
  const { data: u, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.error(userErr);
    setToast("Auth error: " + userErr.message);
    setBusy(false);
    return;
  }

  const uid = u.user?.id;
  if (!uid) {
    setToast("Please sign in to create a draft.");
    setBusy(false);
    return;
  }

  const { data, error } = await supabase
    .from("trajectories")
    .insert({
      title,
      commitment,
      summary: null,
      status: "draft",
      // owner_id НЕ передаємо — DB ставить default auth.uid()
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    setToast("Create error: " + error.message);
    setBusy(false);
    return;
  }

  setToast(`Draft created: ${shortId(data.id)}`);
  setDraftTitle("");
  setDraftCommitment("");
  await loadLatest();
  setBusy(false);
}

  function openLockModal(t: Trajectory) {
    setToast(null); // ✅ prevents "Draft created..." showing inside lock modal footer

    setLockId(t.id);
    setLockOpen(true);
    setReason("");
    setConfirmText("");
    setStakePreset(null);
    setStakeCustom("");
    setLockLoading(false);

    setLockCoreTitle(t.title ?? "");
    setLockCoreCommitment(t.commitment ?? "");
  }

  async function lockTrajectory(id: string | null) {
    if (!id) {
      setToast("Internal error: missing trajectory id");
      return;
    }
    if (lockLoading) return;
    setLockLoading(true);
    setToast(null);

    const title = lockCoreTitle.trim();
    const commitment = lockCoreCommitment.trim();

    if (title.length < 3 || commitment.length < 8) {
      setToast("Lock requires a title (≥3) and a commitment statement (≥8).");
      setLockLoading(false);
      return;
    }
    if (!canLockTyped) {
      setToast('Type "LOCK" to proceed.');
      setLockLoading(false);
      return;
    }

    // ✅ IMPORTANT: persist stake + reason in DB
    const payload: Record<string, any> = {
      title,
      commitment,
      status: "locked",
      locked_at: new Date().toISOString(),
      stake_amount: stakeAmount ?? null,
      stake_currency: stakeAmount ? "USD" : null,
      lock_reason: reason?.trim() ? reason.trim() : null,
    };

    const { error } = await supabase.from("trajectories").update(payload).eq("id", id);

    if (error) {
      console.error("Lock error:", error);
      setToast("Lock error: " + error.message);
      setLockLoading(false);
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
    setLockLoading(false);
  }

  function openAmendModal(t: Trajectory, kind: AmendmentKind = "MILESTONE") {
    setToast(null);
    setAmendTrajectoryId(t.id);
    setAmendKind(kind);
    setAmendBody("");
    setAmendConfirm("");
    if (kind === "OUTCOME") setOutcomeResult("COMPLETED"); // ✅ reset
    setAmendOpen(true);
  }

  async function addAmendment() {
    if (!amendTrajectoryId) return;

    setToast(null);

    const contentRaw = amendBody.trim();

    if (contentRaw.length < 5) {
      setToast("Amendment text is too short.");
      return;
    }
    if (amendConfirm.trim().toUpperCase() !== "AMEND") {
      setToast('Type "AMEND" to proceed.');
      return;
    }

    // ✅ If OUTCOME — finalize trajectory status permanently
    if (amendKind === "OUTCOME") {
      const finalStatus = outcomeResult === "COMPLETED" ? "completed" : "failed";

      const { error: outErr } = await supabase
        .from("trajectories")
        .update({
          status: finalStatus,
        })
        .eq("id", amendTrajectoryId);

      if (outErr) {
        console.error(outErr);
        setToast("Outcome error: " + outErr.message);
        return;
      }
    }

    // store amendment log (for OUTCOME we prefix result)
    const content =
      amendKind === "OUTCOME"
        ? `[${outcomeResult}] ${contentRaw}`
        : contentRaw;

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

    // if DROP — mark trajectory dropped_at
    if (amendKind === "DROP") {
      const { error: dropErr } = await supabase
        .from("trajectories")
        .update({ dropped_at: new Date().toISOString() })
        .eq("id", amendTrajectoryId);

      if (dropErr) console.warn("dropped_at update warn:", dropErr.message);
    }

    setToast(`${amendKind} recorded`);
    setAmendOpen(false);
    setAmendTrajectoryId(null);
    setAmendBody("");
    setAmendConfirm("");

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
    "Launch a product and reach $100k revenue",
    "Stop alcohol for 180 days",
    "Read 20 books in 2026",
    "Move to a different country and rebuild from zero",
  ];

  return (
        <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-24">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">Lockpoint</h1>

        <p className="mt-3 text-lg leading-8 text-zinc-700 dark:text-zinc-200">
          <strong>Where decisions become irreversible futures.</strong>
        </p>
<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
  <Link
    href="/me"
    className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
  >
    My cabinet →
  </Link>

  <span className="text-xs text-zinc-500 dark:text-zinc-400">
    Your drafts and locked records
  </span>
</div>
        <p className="mt-6 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          Create a draft trajectory. When you reach the lockpoint, you lock it. After lock:{" "}
          <strong>no edits</strong>, <strong>no deletes</strong> — <strong>amendments only</strong>.
        </p>

        {/* Rule block */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex gap-4">
            <div className="w-1 rounded-full bg-zinc-900 dark:bg-white" />
            <div>
              <div className="text-xl font-semibold leading-snug tracking-tight">{SYSTEM_FORMULA}</div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold">Lockpoint is not a planner, tracker, or coach.</span>{" "}
                It records a commitment, locks it in time, and later records the outcome — unchanged, forever.
                <span className="block mt-2 text-zinc-500 dark:text-zinc-400">
                  If you complete it, the record stands. If you fail, the record still stands.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Examples of locked trajectories</div>
          <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            {EXAMPLES.map((x) => (
              <div key={x} className="flex gap-3">
                <span className="select-none font-mono text-zinc-400 dark:text-zinc-500">—</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Draft inputs */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Create draft</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            A draft can be edited. A lock cannot.
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Title</label>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              placeholder="e.g. No social media for 12 months"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Commitment statement
            </label>
            <textarea
              value={draftCommitment}
              onChange={(e) => setDraftCommitment(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              rows={3}
              placeholder='One sentence. Example: "I will delete all social media accounts by 2026-01-10 and not return for 12 months."'
            />
          </div>

          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Minimum: title ≥ 3 chars, statement ≥ 8 chars.
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={busy || !canCreateDraft}
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
        </div>

        {/* Registry */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Registry</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Drafts are editable. Locked records are permanent.
          </div>

          <div className="mt-4 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No trajectories yet.</div>
            ) : (
              items.map((t) => {
                const status = String(t.status || "").toLowerCase();
                const isLocked = status === "locked" || !!t.locked_at;
                const isFinal = status === "completed" || status === "failed";

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
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.title}</div>

                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="font-mono">{shortId(t.id)}</span>
                          {" · "}
                          <span className="uppercase tracking-wide">
                            {t.status ? String(t.status).toUpperCase() : isLocked ? "LOCKED" : "DRAFT"}
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
                            <span className="font-medium text-zinc-700 dark:text-zinc-200">commitment:</span>{" "}
                            {t.commitment}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {!isLocked ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              onClick={() => openLockModal(t)}
                            >
                              LOCK THIS
                            </button>

                            <button
                              type="button"
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              onClick={() => openAmendModal(t, "DROP")}
                            >
                              DROP
                            </button>

                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 text-right">
                              Drop discards a draft only.
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                              {isFinal ? "Final" : "Irreversible"}
                            </span>

                            {!isFinal ? (
                              <>
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300 text-right">
                                  <div className="font-semibold">Choose your next action</div>
                                  <div className="opacity-80">
                                    Amend clarifies the record. Outcome finalizes it forever.
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                    onClick={() => openAmendModal(t, "MILESTONE")}
                                    title="Clarify or add a factual milestone"
                                  >
                                    AMEND
                                  </button>

                                  <button
                                    type="button"
                                    className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                    onClick={() => openAmendModal(t, "OUTCOME")}
                                    title="Record the final outcome (finalizes forever)"
                                  >
                                    OUTCOME
                                  </button>
                                </div>

                                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 text-right">
                                  Once an outcome is recorded, this lock becomes final and cannot be changed.
                                </div>
                              </>
                            ) : (
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 text-right">
                                This record is finalized.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lock modal */}
        {lockOpen && lockId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onMouseDown={() => !lockLoading && setLockOpen(false)}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-black flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* SCROLL BODY */}
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
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Title</label>
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
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
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

              {/* FOOTER */}
              <div className="border-t border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-black">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
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
                  onClick={() => lockTrajectory(lockId)}
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

        {/* Amendment modal */}
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

                {/* ✅ Outcome selector */}
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
                    RECORD AMENDMENT
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
      </main>
    </div>
        );
}
