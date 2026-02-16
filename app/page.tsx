"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";

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

type StatusFilter = "all" | "locked" | "completed" | "failed";
type DeadlineFilter = "any" | "this_week" | "this_month" | "expired";
type SortMode = "newest" | "deadline" | "recently_locked";

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}

function fmtPrettyDate(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso);
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getISODatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getStartOfTodayISO() {
  return startOfToday().toISOString();
}

function money(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
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
      ? "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
      : s === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : s === "failed"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
      : "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        cls
      )}
    >
      {label}
    </span>
  );
}

function duePill(deadlineIso?: string | null) {
  if (!deadlineIso) return null;
  const dl = new Date(deadlineIso);
  const today = startOfToday();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);

  const isOverdue = dl.getTime() < today.getTime();
  const isSoon = !isOverdue && dl.getTime() <= soon.getTime();

  if (!isOverdue && !isSoon) return null;

  const label = isOverdue ? "OVERDUE" : "DUE SOON";
  const cls = isOverdue
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";

  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {label}
    </span>
  );
}

const EXAMPLES = [
  "Ship one release every week for 12 weeks",
  "Make 10 sales by 2026-04-01",
  "Reach $10,000 monthly revenue by 2026-09-01",
  "Quit alcohol for 180 days",
  "Delete social media for 12 months",
  "Run a marathon before 2026-10-01",
];

type Pulse = {
  locked: number;
  completed: number;
  failed: number;
  dueSoon: number;
  overdue: number;
  stakesSum: number;
};

export default function Home() {
  const registryRef = useRef<HTMLDivElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Auth
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Draft create
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCommitment, setDraftCommitment] = useState("");

  const canCreateDraft = useMemo(() => {
    const t = draftTitle.trim();
    const c = draftCommitment.trim();
    return t.length >= 3 && c.length >= 8;
  }, [draftTitle, draftCommitment]);

  // Pulse
  const [pulse, setPulse] = useState<Pulse>({
    locked: 0,
    completed: 0,
    failed: 0,
    dueSoon: 0,
    overdue: 0,
    stakesSum: 0,
  });
  const [loadingPulse, setLoadingPulse] = useState(true);

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

  // Feedback (API)
  const [fbEmail, setFbEmail] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSending, setFbSending] = useState(false);

  function scrollToRegistry() {
    registryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetPaging() {
    setPage(1);
  }

  // --- Auth bootstrap
  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setToast(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/me` },
    });
  }

  async function signOut() {
    setToast(null);
    await supabase.auth.signOut();
    setToast("Signed out.");
  }

  // --- Pulse load
  async function loadPulse() {
    setLoadingPulse(true);
    try {
      const base = supabase.from("trajectories").select("id", { count: "exact", head: true }).eq("is_public", true);

      const [lockedR, completedR, failedR] = await Promise.all([
        base.eq("status", "locked"),
        base.eq("status", "completed"),
        base.eq("status", "failed"),
      ]);

      const todayIso = getStartOfTodayISO();
      const soonIso = getISODatePlusDays(7);

      const dueSoonR = await supabase
        .from("trajectories")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true)
        .in("status", ["locked", "completed", "failed"])
        .gte("deadline_at", todayIso)
        .lte("deadline_at", soonIso);

      const overdueR = await supabase
        .from("trajectories")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true)
        .in("status", ["locked", "completed", "failed"])
        .lt("deadline_at", todayIso);

      const stakesR = await supabase
        .from("trajectories")
        .select("stake_amount")
        .eq("is_public", true)
        .not("stake_amount", "is", null)
        .limit(2000);

      const stakesSum = (stakesR.data ?? []).reduce((acc: number, r: any) => acc + (Number(r.stake_amount) || 0), 0);

      setPulse({
        locked: lockedR.count ?? 0,
        completed: completedR.count ?? 0,
        failed: failedR.count ?? 0,
        dueSoon: dueSoonR.count ?? 0,
        overdue: overdueR.count ?? 0,
        stakesSum,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPulse(false);
    }
  }

  // --- Registry load
  async function loadRegistry(p: number) {
    setLoadingList(true);

    let q = supabase
      .from("trajectories")
      .select("id,title,status,created_at,locked_at,deadline_at,stake_amount,stake_currency")
      .eq("is_public", true);

    if (statusFilter === "all") q = q.in("status", ["locked", "completed", "failed"]);
    else q = q.eq("status", statusFilter);

    if (deadlineFilter === "this_week") q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(7));
    else if (deadlineFilter === "this_month") q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(31));
    else if (deadlineFilter === "expired") q = q.lt("deadline_at", getStartOfTodayISO());

    if (withStakeOnly) q = q.not("stake_amount", "is", null);

    if (sortMode === "deadline") q = q.order("deadline_at", { ascending: true, nullsFirst: false });
    else if (sortMode === "recently_locked") q = q.order("locked_at", { ascending: false, nullsFirst: false });
    else q = q.order("locked_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
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

  // reset paging when filters change
  useEffect(() => {
    resetPaging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, deadlineFilter, withStakeOnly, sortMode]);

  // initial load
  useEffect(() => {
    loadPulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // list load
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
      setBusy(false);
      await new Promise((r) => setTimeout(r, 250));
      await signIn();
      return;
    }

    const { data, error } = await supabase
      .from("trajectories")
      .insert({ owner_id: uid, title, commitment, status: "draft", is_public: false })
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

  async function sendFeedback() {
    if (fbSending) return;
    const message = fbMsg.trim();
    if (!message) return;

    setFbSending(true);
    setToast(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: fbEmail.trim() || null, message, page: "/" }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setToast(j?.error ? `Feedback failed: ${j.error}` : "Feedback failed.");
        setFbSending(false);
        return;
      }

      setFbEmail("");
      setFbMsg("");
      setToast("Sent. Thank you.");
    } catch (e) {
      console.error(e);
      setToast("Feedback failed.");
    } finally {
      setFbSending(false);
    }
  }

  const whatYouGet = [
    { t: "A public deadline", d: "A date you can’t quietly move." },
    { t: "A permanent record", d: "No rewrites. No erasing" },
    { t: "A visible execution history", d: "Your follow-through becomes visible." },
    { t: "Reputation based on outcomes", d: "Completion and failure both count." },
  ];

  return (
    <div className="bg-transparent font-sans text-zinc-900 dark:text-zinc-50">
      <Header
        userId={userId}
        userEmail={userEmail}
        onSignIn={signIn}
        onSignOut={signOut}
        onGoRegistry={scrollToRegistry}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-0 sm:px-6 sm:pt-14 sm:pb-0">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-50 to-white dark:from-white/5 dark:to-black/30" />

          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-8">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-2xl">Make a decision you cannot walk back.</h1>

              <p className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Public. Permanent. Outcome recorded.
              </p>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                Lockpoint is a public registry for irreversible commitments. Once locked, the record stays. Only outcomes can be added.
              </p>

              <div className="mt-5 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
                Over time, consistent execution becomes capital - a measurable public reliability signal.
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {["Immutable", "Public", "Timestamped", "No edits"].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                  >
                    {x}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
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
            </div>

            <div className="lg:col-span-4 lg:justify-self-end">
              <div className="flex flex-col gap-3 lg:items-end">
                <Link
                  href="/me"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 lg:w-auto"
                >
                  Lock a decision
                </Link>

                <button
                  type="button"
                  onClick={scrollToRegistry}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10 lg:w-auto"
                >
                  View registry
                </button>

                <div className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 lg:text-right">
                  Drafts → Lock → Outcomes
                </div>
              </div>
            </div>
          </div>

          {/* WHAT YOU GET */}
          <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {whatYouGet.map((x) => (
              <div
                key={x.t}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-black/20"
              >
                <div className="text-sm font-semibold">{x.t}</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{x.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CREATE + PULSE */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Create */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Create decision draft</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Drafts are editable. Locking is irreversible.
                </div>
              </div>
              <Link
                href="/me"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                My cabinet →
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold">Title</label>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-white/10 dark:bg-black/20"
                  placeholder="e.g. No social media for 12 months"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Commitment statement</label>
                <textarea
                  value={draftCommitment}
                  onChange={(e) => setDraftCommitment(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-white/10 dark:bg-black/20"
                  rows={4}
                  placeholder='Example: "I will delete all social media by 2026-02-01 and not return for 12 months."'
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={busy || !canCreateDraft}
                  onClick={createDraft}
                  className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {busy ? "Creating…" : "Create draft →"}
                </button>

                {toast ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200">
                    {toast}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Not signed in? You’ll be redirected to Google.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pulse */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Pulse</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Public execution history (immutable).
                </div>
              </div>
              <button
                type="button"
                onClick={loadPulse}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Refresh →
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { k: "Locked", v: pulse.locked },
                { k: "Completed", v: pulse.completed },
                { k: "Failed", v: pulse.failed },
                { k: "Due soon (7d)", v: pulse.dueSoon },
                { k: "Overdue", v: pulse.overdue },
                { k: "At stake", v: pulse.stakesSum ? `$${money(pulse.stakesSum)}` : "—" },
              ].map((c) => (
                <div
                  key={c.k}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-black/20"
                >
                  <div className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                    {c.k.toUpperCase()}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">{loadingPulse ? "…" : c.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
              Decisions change people. Public irreversibility creates pressure.
            </div>
          </div>
        </section>

        {/* Examples */}
        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Examples</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map((x) => (
              <div
                key={x}
                className="flex gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
              >
                <span className="select-none font-mono text-zinc-400 dark:text-zinc-500">—</span>
                <span className="min-w-0">{x}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Registry */}
        <section ref={registryRef} className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Public Registry</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Public records only. Immutable once locked.
              </div>
            </div>
            <Link
              href="/me"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              My cabinet →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-9">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <label className="w-20 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-black/20"
                  >
                    <option value="locked">Locked</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">Deadline</label>
                  <select
                    value={deadlineFilter}
                    onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
                    className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-black/20"
                  >
                    <option value="any">Any</option>
                    <option value="this_week">This week</option>
                    <option value="this_month">This month</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-20 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">Sort</label>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-black/20"
                  >
                    <option value="newest">Newest</option>
                    <option value="recently_locked">Recently locked</option>
                    <option value="deadline">Deadline first</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <button
                type="button"
                onClick={() => setWithStakeOnly((v) => !v)}
                className={cx(
                  "flex h-10 w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold",
                  "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  "dark:border-white/10 dark:bg-black/20 dark:text-zinc-200 dark:hover:bg-white/5"
                )}
                aria-pressed={withStakeOnly}
              >
                <span>Stake only</span>
                <span
                  className={cx(
                    "inline-flex h-6 w-11 items-center rounded-full border px-1 transition",
                    withStakeOnly
                      ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white"
                      : "border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20"
                  )}
                >
                  <span
                    className={cx(
                      "h-4 w-4 rounded-full bg-white transition dark:bg-black",
                      withStakeOnly ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No records found.</div>
            ) : (
              items.map((t) => {
                const isLocked = String(t.status ?? "").toLowerCase() === "locked";
                return (
                  <Link
                    key={t.id}
                    href={`/t/${t.id}`}
                    className="block rounded-2xl border border-zinc-200 bg-white px-4 py-4 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.title}</div>

                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
                          <div className="font-mono text-zinc-500 dark:text-zinc-400">{shortId(t.id)}</div>

                          <div className="sm:text-right text-zinc-500 dark:text-zinc-400">
                            {t.locked_at ? `Locked ${fmtPrettyDate(t.locked_at)}` : `Created ${fmtPrettyDate(t.created_at)}`}
                          </div>

                          <div className="text-zinc-500 dark:text-zinc-400">
                            {t.deadline_at ? `Deadline ${fmtPrettyDate(t.deadline_at)}` : "No deadline"}
                          </div>

                          <div className="sm:text-right text-zinc-500 dark:text-zinc-400">
                            {t.stake_amount != null
                              ? `Stake ${t.stake_amount}${t.stake_currency ? ` ${t.stake_currency}` : ""}`
                              : "No stake"}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {isLocked ? duePill(t.deadline_at) : null}
                          {statusPill(t.status)}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1 || loadingList}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
            >
              ← Prev
            </button>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">Page {page}</div>

            <button
              type="button"
              disabled={!hasMore || loadingList}
              onClick={() => setPage((p) => p + 1)}
              className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
            >
              Next →
            </button>
          </div>
        </section>

        {/* Why irreversible */}
        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Why irreversible?</div>

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-zinc-700 dark:text-zinc-200 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
              <div className="font-semibold">Editability kills seriousness</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">If it can be rewritten, it was never real.</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
              <div className="font-semibold">Public memory creates pressure</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">A public promise changes behavior.</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
              <div className="font-semibold">Outcomes don’t disappear</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Failure is recorded, not hidden.</div>
            </div>
          </div>
        </section>

        {/* Feedback */}
        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Feedback</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Tell me what broke or what you want next.</div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold">Email (optional)</label>
              <input
                value={fbEmail}
                onChange={(e) => setFbEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-white/10 dark:bg-black/20"
                placeholder="you@email.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold">Message</label>
              <textarea
                value={fbMsg}
                onChange={(e) => setFbMsg(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-white/10 dark:bg-black/20"
                rows={4}
                placeholder="Feedback, ideas, collaboration — anything you want to share."
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={!fbMsg.trim() || fbSending}
              onClick={sendFeedback}
              className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {fbSending ? "Sending…" : "Send feedback →"}
            </button>

            {toast ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{toast}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
