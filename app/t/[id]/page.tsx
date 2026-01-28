"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ShareBar from "@/components/ShareBar";

type TrajectoryStatus = "draft" | "locked" | "completed" | "failed";

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

  // OPTIONAL DB FIELD (you asked for it)
  // If your DB doesn't have this column yet, updates/selects will error until you add it.
  is_public?: boolean | null;
};

type AmendmentKind = "MILESTONE" | "NOTE" | "OUTCOME" | "DROP";

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
  return s === "locked" || s === "completed" || s === "failed";
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return null;
  const x = Math.round(n);
  return x > 0 ? x : null;
}

export default function TrajectoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<string | null>(null);
  const [t, setT] = useState<Trajectory | null>(null);
  const [amends, setAmends] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // ACTION busy flags
  const [lockLoading, setLockLoading] = useState(false);
  const [amendLoading, setAmendLoading] = useState(false);

  // LOCK UI
  const [lockConfirm, setLockConfirm] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [stakePreset, setStakePreset] = useState<number | null>(null);
  const [stakeCustom, setStakeCustom] = useState<string>("");
  const [deadlineLocal, setDeadlineLocal] = useState<string>(""); // input type="datetime-local"

  // AMEND UI
  const [amendKind, setAmendKind] = useState<AmendmentKind>("MILESTONE");
  const [amendText, setAmendText] = useState("");
  const [amendConfirm, setAmendConfirm] = useState("");
  const [outcomeResult, setOutcomeResult] = useState<"completed" | "failed">("completed");

  const isOwner = useMemo(() => {
    if (!t || !me) return false;
    return t.owner_id === me;
  }, [t, me]);

  const statusLower = useMemo(() => (t?.status ?? "").toLowerCase(), [t?.status]);
  const isDraft = statusLower === "draft";
  const isLocked = statusLower === "locked";
  const isFinal = statusLower === "completed" || statusLower === "failed";
  const isDropped = !!t?.dropped_at || statusLower === "failed";

  // PUBLIC RULE:
  // - You asked: "public only by choice (is_public)"
  // - If DB has is_public: use it.
  // - If not: fallback to old behavior (public if locked/final).
const isPublic = useMemo(() => {
  if (!t) return false;
  return t.is_public === true;
}, [t]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/t/${id}`;
  }, [id]);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Link copied.");
    } catch {
      setToast("Could not copy link.");
    }
  }

  const stakeAmount = useMemo(() => {
    if (stakePreset != null) return clampInt(stakePreset);
    const n = Number(String(stakeCustom).replace(/[^\d.]/g, ""));
    return clampInt(n);
  }, [stakePreset, stakeCustom]);

  const lockCoreOk = useMemo(() => {
    const titleOk = (t?.title ?? "").trim().length >= 3;
    const commOk = (t?.commitment ?? "").trim().length >= 8;
    return titleOk && commOk;
  }, [t?.title, t?.commitment]);

  const canLockTyped = useMemo(
    () => lockConfirm.trim().toUpperCase() === "LOCK",
    [lockConfirm]
  );

  const lockDisabledReason = useMemo(() => {
    if (!t) return "Loading…";
    if (!isOwner) return "Owner only.";
    if (!isDraft) return "Only drafts can be locked.";
    if (!lockCoreOk) return "Title ≥ 3 chars and commitment ≥ 8 chars are required.";
    if (!canLockTyped) return 'Type "LOCK" to proceed.';
    return null;
  }, [t, isOwner, isDraft, lockCoreOk, canLockTyped]);

  const amendMinLen = useMemo(() => {
        if (amendKind === "NOTE") return 3;
    return 5;
  }, [amendKind]);

  const amendDisabledReason = useMemo(() => {
    if (!t) return "Loading…";
    if (!isOwner) return "Owner only.";
    if (isDraft) return "Lock first. Amendments start after lock.";
    if (isFinal) return "Finalized records are closed.";
    if (isFinal && amendKind === "OUTCOME") return "Outcome already finalized.";
    if (amendKind === "OUTCOME" && !isLocked) return "Outcome can be recorded only from LOCKED state.";
    if (amendConfirm.trim().toUpperCase() !== "AMEND") return 'Type "AMEND" to record.';
    if (amendText.trim().length < amendMinLen) return `Minimum ${amendMinLen} characters.`;
    return null;
  }, [t, isOwner, isDraft, isDropped, isFinal, isLocked, amendKind, amendConfirm, amendText, amendMinLen]);

  function deadlineToISO(dtLocal: string) {
    // dtLocal comes like "2026-01-22T18:30"
    if (!dtLocal) return null;
    const d = new Date(dtLocal);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setToast(null);

    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMe(uid);

      // NOTE: includes is_public (optional column)
      const { data: traj, error: tErr } = await supabase
        .from("trajectories")
        .select(
          "id,owner_id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at,lock_reason,stake_amount,stake_currency,is_public"
        )
        .eq("id", id)
        .single();

      if (tErr) throw tErr;

      const status = (traj?.status ?? "").toLowerCase();
      const ownerOk = !!uid && !!traj?.owner_id && traj.owner_id === uid;

      // Privacy rules:
      // - draft: owner only
      // - dropped: owner only
      // - locked/final: public only if is_public=true (if column exists), otherwise public by status
      const dropped = !!traj?.dropped_at || status === "dropped";
      if (status === "draft" && !ownerOk) {
        setT(null);
        setAmends([]);
        setToast("Private draft. Sign in as the owner to view.");
        return;
      }
      if (dropped && !ownerOk) {
        setT(null);
        setAmends([]);
        setToast("Private record.");
        return;
      }


// Non-owner can view ONLY if is_public = true
if (!ownerOk && traj?.is_public !== true) {
  setT(null);
  setAmends([]);
  setToast("Private record.");
  return;
}

      setT(traj as Trajectory);

      // Sync lock UI defaults
      setLockReason((traj as any)?.lock_reason ?? "");
           if ((traj as any)?.deadline_at) {
        // convert ISO -> datetime-local value
        const d = new Date((traj as any).deadline_at);
        if (!Number.isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const mi = String(d.getMinutes()).padStart(2, "0");
          setDeadlineLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
        }
      } else {
        setDeadlineLocal("");
      }

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

  async function lockNow() {
    if (!t || !id) return;
    if (lockDisabledReason) {
      setToast(lockDisabledReason);
      return;
    }
    setLockLoading(true);
    setToast(null);

    try {
      const deadlineISO = deadlineToISO(deadlineLocal);

      const payload: Record<string, any> = {
        status: "locked",
        locked_at: new Date().toISOString(),
        lock_reason: lockReason.trim() ? lockReason.trim() : null,
        stake_amount: stakeAmount ?? null,
        stake_currency: stakeAmount ? "USD" : null,
        deadline_at: deadlineISO,
      };

      // only send if you have this column
      payload.is_public = true;

      const { error } = await supabase.from("trajectories").update(payload).eq("id", id);
      if (error) throw error;

      setLockConfirm("");
      setStakePreset(null);
      setStakeCustom("");
      setToast("LOCKED · irreversible");
      await load();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message ?? "Lock failed");
    } finally {
      setLockLoading(false);
    }
  }

  async function dropDraft() {
    if (!t || !id) return;
    if (!isOwner) return setToast("Owner only.");
    if (!isDraft) return setToast("Only drafts can be dropped.");

    setAmendLoading(true);
    setToast(null);
    try {
      // record amendment log too (optional)
      const reason = amendText.trim() || "Dropped.";

      // update trajectory -> dropped
      const { error: upErr } = await supabase
        .from("trajectories")
        .update({
  status: "failed",
  dropped_at: new Date().toISOString(),
  is_public: false, // щоб точно не попав у public registry
})
        .eq("id", id);

      if (upErr) throw upErr;

      // store amendment entry
      const { error: aErr } = await supabase.from("trajectory_amendments").insert({
        trajectory_id: id,
        kind: "DROP",
        content: reason,
      });

      if (aErr) throw aErr;

      setToast("DROPPED");
      setAmendText("");
      setAmendConfirm("");
      await load();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message ?? "Drop failed");
    } finally {
      setAmendLoading(false);
    }
  }

  async function recordAmendment() {
    if (!t || !id) return;
    if (amendDisabledReason) {
      setToast(amendDisabledReason);
      return;
    }

    setAmendLoading(true);
    setToast(null);

    try {
      const contentRaw = amendText.trim();

      // OUTCOME: finalize trajectory status FIRST, then insert amendment
      if (amendKind === "OUTCOME") {
        // allow only LOCKED -> (completed/failed)
        if (!isLocked) {
          throw new Error("Outcome can be recorded only from LOCKED state.");
        }

        const { error: outErr } = await supabase
          .from("trajectories")
          .update({
            status: outcomeResult, // "completed" | "failed"
          })
          .eq("id", id);

        if (outErr) throw outErr;
      }

      const content =
        amendKind === "OUTCOME" ? `[${outcomeResult.toUpperCase()}] ${contentRaw}` : contentRaw;

      const { error } = await supabase.from("trajectory_amendments").insert({
        trajectory_id: id,
        kind: amendKind,
        content,
      });

      if (error) throw error;

      setToast(`${amendKind} recorded`);
      setAmendText("");
      setAmendConfirm("");
      setAmendKind("MILESTONE");
      setOutcomeResult("completed");
      await load();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message ?? "Amendment failed");
    } finally {
      setAmendLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Record</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Immutable view + amendment log.
            </p>
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

                  {t.stake_amount ? (
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
                        onClick={copyShare}
                        className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      >
                        Copy share link
                      </button>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Public record.
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Private record.
                    </div>
                  )}

                  {isOwner ? (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">You are the owner.</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* OWNER ACTIONS */}
            {isOwner && !isDropped ? (
              <>
                {/* LOCK SECTION (draft only) */}
                {isDraft ? (
                  <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="text-sm font-semibold">Lock</div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      Locking makes this record irreversible. You can add outcome later.
                    </div>

                    {/* Deadline */}
                    <div className="mt-4">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Deadline (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={deadlineLocal}
                        onChange={(e) => setDeadlineLocal(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                      />
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Format is international (YYYY-MM-DD).
                      </div>
                    </div>

                    {/* Reason */}
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

                    {/* Stake */}
                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
                      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                        Optional stake (beta)
                      </div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        Symbolic during beta. Not charged.
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
                                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10",
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
                        {stakeAmount ? (
                          <>
                            Selected stake: <span className="font-mono">${stakeAmount}</span>
                          </>
                        ) : (
                          "No stake attached."
                        )}
                      </div>
                    </div>

                    {/* Confirm LOCK */}
                    <div className="mt-4">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Type <span className="font-mono">LOCK</span> to proceed
                      </label>
                      <input
                        value={lockConfirm}
                        onChange={(e) => setLockConfirm(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-mono outline-none dark:border-white/10 dark:bg-white/5"
                        placeholder="LOCK"
                      />
                      {lockDisabledReason ? (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {lockDisabledReason}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Current time will be recorded.
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!!lockDisabledReason || lockLoading}
                        onClick={lockNow}
                        className="mt-3 h-11 w-full rounded-full bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      >
                        {lockLoading ? "Locking…" : "LOCK — irreversible"}
                      </button>

                      {/* Drop draft */}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Drop discards a draft only.
                        </div>
                        <button
                          type="button"
                          onClick={() => setAmendKind("DROP")}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        >
                          DROP (draft)
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* AMEND SECTION (locked/final only) */}
                {!isDraft ? (
                  <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="text-sm font-semibold">Add amendment</div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      Amendments are immutable. They extend the record.
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Type</label>
                      <select
                        value={amendKind}
                        onChange={(e) => {
                          const k = e.target.value as AmendmentKind;
                          setAmendKind(k);
                          if (k === "OUTCOME") setOutcomeResult("completed");
                        }}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                      >
                        <option value="MILESTONE">AMEND — clarification / milestone</option>
                        <option value="NOTE">NOTE — short note</option>
                        <option value="OUTCOME" disabled={!isLocked}>
                          OUTCOME — final result (locked only)
                        </option>
                      </select>
                      {!isLocked ? (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Outcome is available only while status is <span className="font-mono">locked</span>.
                        </div>
                      ) : null}
                    </div>

                    {amendKind === "OUTCOME" && (
                      <div className="mt-4">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          Outcome
                        </label>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setOutcomeResult("completed")}
                            className={[
                              "h-9 rounded-full border px-4 text-xs font-medium transition",
                              outcomeResult === "completed"
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10",
                            ].join(" ")}
                          >
                            ✅ Completed
                          </button>

                          <button
                            type="button"
                            onClick={() => setOutcomeResult("failed")}
                            className={[
                              "h-9 rounded-full border px-4 text-xs font-medium transition",
                              outcomeResult === "failed"
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10",
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
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Text
                      </label>
                      <textarea
                        value={amendText}
                        onChange={(e) => setAmendText(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                        rows={3}
                        placeholder="Leave feedback, a factual milestone, a note, or record the outcome."
                      />
                      {amendText.trim().length > 0 && amendText.trim().length < amendMinLen ? (
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Minimum {amendMinLen} characters
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Type <span className="font-mono">AMEND</span> to record
                      </label>
                      <input
                        value={amendConfirm}
                        onChange={(e) => setAmendConfirm(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-mono outline-none dark:border-white/10 dark:bg-white/5"
                        placeholder="AMEND"
                      />
                      {amendDisabledReason ? (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {amendDisabledReason}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Current time will be recorded.
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!!amendDisabledReason || amendLoading}
                      onClick={recordAmendment}
                      className="mt-4 h-11 w-full rounded-full bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      {amendLoading ? "Recording…" : "RECORD"}
                    </button>
                  </div>
                ) : null}

                {/* DROP ACTION (draft only, when amendKind was switched) */}
                {isDraft && amendKind === "DROP" ? (
                  <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="text-sm font-semibold">Drop draft</div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      This discards a draft only. Private.
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Reason (optional)
                      </label>
                      <textarea
                        value={amendText}
                        onChange={(e) => setAmendText(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                        rows={2}
                        placeholder="Why are you dropping this?"
                      />
                      {amendText.trim().length > 0 && amendText.trim().length < 1 ? (
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Minimum 1 character
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Type <span className="font-mono">AMEND</span> to confirm
                      </label>
                      <input
                        value={amendConfirm}
                        onChange={(e) => setAmendConfirm(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-mono outline-none dark:border-white/10 dark:bg-white/5"
                        placeholder="AMEND"
                      />
                      {amendConfirm.trim().toUpperCase() !== "AMEND" ? (
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Type "AMEND" to drop.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAmendKind("MILESTONE");
                          setAmendText("");
                          setAmendConfirm("");
                        }}
                        className="h-11 w-full rounded-full border border-zinc-200 bg-white text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={amendConfirm.trim().toUpperCase() !== "AMEND" || amendLoading}
                        onClick={dropDraft}
                        className="h-11 w-full rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      >
                        {amendLoading ? "Dropping…" : "DROP"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* AMENDMENTS LIST */}
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
  );
}
