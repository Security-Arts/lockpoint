"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Trajectory = {
  id: string;
  title: string;
  commitment?: string | null;
  status: "draft" | "locked" | "completed" | "failed" | string | null;
  created_at: string;
  locked_at?: string | null;
  deadline_at?: string | null;
  stake_amount?: number | null;
  stake_currency?: string | null;
};

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
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return String(iso);
  }
}

function statusPill(statusRaw?: string | null) {
  const s = String(statusRaw ?? "").toLowerCase();

  const label =
    s === "locked"
      ? "LOCKED"
      : s === "completed"
      ? "COMPLETED"
      : s === "failed"
      ? "FAILED"
      : s
      ? s.toUpperCase()
      : "—";

  const cls =
    s === "locked"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
      : s === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : s === "failed"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      : "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

type StatusFilter = "all" | "locked" | "completed" | "failed";
type DeadlineFilter = "any" | "this_week" | "this_month" | "expired";
type SortMode = "newest" | "deadline" | "recently_locked";

function getISODatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getStartOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const EXAMPLES = [
  // Business
  "Launch a product and make 10 sales by 2026-04-01",
  "Reach $10,000 monthly revenue by 2026-09-01",
  "Ship one release every week for 12 weeks",
  "Sign 3 paying B2B clients by 2026-03-31",
    // Life
  "Delete all social media for 12 months",
  "Visit 8 countries in 2026 ",
  "Run a marathon before 2026-10-01",
  "No alcohol for 180 days",
  "Read 50 books in 2026",
];

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Draft create
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCommitment, setDraftCommitment] = useState("");

  const canCreateDraft = useMemo(() => {
    const t = draftTitle.trim();
    const c = draftCommitment.trim();
    return t.length >= 3 && c.length >= 8;
  }, [draftTitle, draftCommitment]);

  // Registry state
  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("locked");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("any");
  const [withStakeOnly, setWithStakeOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Feedback (mailto)
  const [fbEmail, setFbEmail] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSent, setFbSent] = useState(false);

  function resetPaging() {
    setPage(1);
  }

  async function loadRegistry(p: number) {
    setLoadingList(true);

    // Public registry:
    // - only is_public=true
    // - never show drafts
    let q = supabase
      .from("trajectories")
      .select("id,title,status,created_at,locked_at,deadline_at,stake_amount,stake_currency")
      .eq("is_public", true);

    // Status filter (DB supports: draft, locked, completed, failed)
    if (statusFilter === "all") {
      q = q.in("status", ["locked", "completed", "failed"]);
    } else {
      q = q.eq("status", statusFilter);
    }

    // Deadline filter
    if (deadlineFilter === "this_week") {
      q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(7));
    } else if (deadlineFilter === "this_month") {
      q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(31));
    } else if (deadlineFilter === "expired") {
      q = q.lt("deadline_at", getStartOfTodayISO());
    }

    // Stake filter
    if (withStakeOnly) {
      q = q.not("stake_amount", "is", null);
    }

    // Sort
    if (sortMode === "deadline") {
      q = q.order("deadline_at", { ascending: true, nullsFirst: false });
    } else if (sortMode === "recently_locked") {
      q = q.order("locked_at", { ascending: false, nullsFirst: false });
    } else {
      // newest
      q = q.order("locked_at", { ascending: false, nullsFirst: false }).order("created_at", {
        ascending: false,
      });
    }

    // Pagination:
    // Supabase range(from,to) is inclusive, so we fetch PAGE_SIZE+1 rows.
    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE; // PAGE_SIZE + 1 rows
    const { data, error } = await q.range(from, to);

    if (error) {
      console.error(error);
      setItems([]);
      setHasMore(false);
      setLoadingList(false);
      return;
    }

    const rows = (data ?? []) as Trajectory[];
    setHasMore(rows.length > PAGE_SIZE);
    setItems(rows.slice(0, PAGE_SIZE));
    setLoadingList(false);
  }

  // Reset paging when filters change
  useEffect(() => {
    resetPaging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, deadlineFilter, withStakeOnly, sortMode]);

  // Load registry
  useEffect(() => {
    loadRegistry(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, deadlineFilter, withStakeOnly, sortMode]);

  async function createDraft() {
    if (busy) return;
    setBusy(true);
    setToast(null);

    const title = draftTitle.trim();
    const commitment = draftCommitment.trim();

    if (!canCreateDraft) {
      setToast("Title ≥ 3 chars, commitment ≥ 8 chars.");
      setBusy(false);
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;

    if (!uid) {
      setToast("Please sign in to create drafts.");
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/me` },
      });
      setBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from("trajectories")
      .insert({
        owner_id: uid,
        title,
        commitment,
        status: "draft",
        is_public: false, // ✅ default private
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setToast("Create error: " + error.message);
      setBusy(false);
      return;
    }

    setToast(`Draft created: ${shortId(data.id)} (see My cabinet)`);
    setDraftTitle("");
    setDraftCommitment("");
    setBusy(false);
  }

  function sendFeedbackMailto() {
    setFbSent(false);
    const subject = encodeURIComponent("Lockpoint feedback");
    const body = encodeURIComponent(`From: ${fbEmail || "(not provided)"}\n\nMessage:\n${fbMsg || ""}`);

    window.location.href = "mailto:a.lutsyna@gmail.com?subject=" + subject + "&body=" + body;

    setFbEmail("");
    setFbMsg("");
    setFbSent(true);
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Lockpoint</h1>
            <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-200">
              <strong>Public registry of locked decisions.</strong>
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Decisions here are recorded as irreversible futures.
            </p>

            <Link
              href="/onboarding"
              className="mt-3 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              What is Lockpoint?
            </Link>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/me"
              className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Lock a decision →
            </Link>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Drafts + lock + outcomes</span>
          </div>
        </div>

        {/* Examples */}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Examples</div>
          <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            {EXAMPLES.map((x) => (
              <div key={x} className="flex gap-3">
                <span className="select-none font-mono text-zinc-400 dark:text-zinc-500">—</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Create draft */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Create draft</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Drafts are editable in your cabinet. Locking is irreversible.
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium">Title</label>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              placeholder="e.g. No social media for 12 months"
            />
            {draftTitle.trim().length > 0 && draftTitle.trim().length < 3 && (
              <div className="mt-1 text-xs text-zinc-500">Minimum 3 characters</div>
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium">Commitment statement</label>
            <textarea
              value={draftCommitment}
              onChange={(e) => setDraftCommitment(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              rows={3}
              placeholder='Example: "I will delete all social media by 2026-02-01 and not return for 12 months."'
            />
            {draftCommitment.trim().length > 0 && draftCommitment.trim().length < 8 && (
              <div className="mt-1 text-xs text-zinc-500">Minimum 8 characters</div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={busy || !canCreateDraft}
              onClick={createDraft}
              className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
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

        {/* Public registry */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Registry (public)</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Public records only (is_public = true).
              </div>
            </div>
            <Link
              href="/me"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              My cabinet →
            </Link>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              >
                <option value="locked">Locked</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                Deadline
              </label>
              <select
                value={deadlineFilter}
                onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              >
                <option value="any">Any</option>
                <option value="this_week">This week</option>
                <option value="this_month">This month</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                Sort
              </label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              >
                <option value="newest">Newest</option>
                <option value="recently_locked">Recently locked</option>
                <option value="deadline">Deadline first</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <div>
                <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">Stake</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Show only records with stake</div>
              </div>
              <button
                type="button"
                onClick={() => setWithStakeOnly((v) => !v)}
                className={`h-8 w-14 rounded-full border px-1 transition ${
                  withStakeOnly
                    ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white"
                    : "border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20"
                }`}
                aria-pressed={withStakeOnly}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-white transition dark:bg-black ${
                    withStakeOnly ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="mt-5 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No records found.</div>
            ) : (
              items.map((t) => (
                <Link
                  key={t.id}
                  href={`/t/${t.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white px-3 py-3 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="font-mono">{shortId(t.id)}</span>
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
                        {t.stake_amount != null ? (
                          <>
                            {" · "}
                            <span className="text-zinc-500 dark:text-zinc-400">
                              stake {t.stake_amount}
                              {t.stake_currency ? ` ${t.stake_currency}` : ""}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0">{statusPill(t.status)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1 || loadingList}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium
hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60
focus:outline-none focus:ring-2 focus:ring-zinc-400/40
dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              ← Prev
            </button>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">Page {page}</div>

            <button
              type="button"
              disabled={!hasMore || loadingList}
              onClick={() => setPage((p) => p + 1)}
              className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium
hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60
focus:outline-none focus:ring-2 focus:ring-zinc-400/40
dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Feedback */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Feedback</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Tell me what broke or what you want next.</div>

          <div className="mt-4">
            <label className="text-xs font-medium">Email</label>
            <input
              value={fbEmail}
              onChange={(e) => setFbEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              placeholder="you@email.com"
            />
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium">Message</label>
            <textarea
              value={fbMsg}
              onChange={(e) => setFbMsg(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              rows={3}
              placeholder="Feedback, ideas, collaboration - anything you want to share."
            />
          </div>

          <button
            type="button"
            disabled={!fbMsg.trim()}
            onClick={sendFeedbackMailto}
            className="mt-4 h-11 rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            Send
          </button>

          {fbSent ? (
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Sent. Thank you.</div>
          ) : null}
        </div>

        {/* Footer links */}
        <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="opacity-80">Lockpoint is not a legal or financial enforcement system.</span>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">
            Privacy
          </Link>
          <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">
            Disclaimer
          </Link>
        </div>
      </main>
    </div>
  );
}
