"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";

type Trajectory = {
  id: string;
  title: string;
  commitment?: string | null;
  status: "draft" | "locked" | "completed" | "dropped" | string | null;
  created_at: string;
  locked_at?: string | null;
  deadline_at?: string | null;
  stake_amount?: number | null;
  stake_currency?: string | null;
};

type StatusFilter = "all" | "locked" | "completed" | "dropped";
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
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}

const MONO = { fontFamily: "var(--font-dm-mono), monospace" };
const SERIF = { fontFamily: "var(--font-fraunces), serif" };
const ACCENT = "#00C98A";
const CLIP = {
  clipPath:
    "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
};
const CLIP_SM = {
  clipPath:
    "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
};

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status ?? "").toLowerCase();
  const label =
    s === "locked"
      ? "LOCKED"
      : s === "completed"
      ? "COMPLETED"
      : s === "dropped" || s === "failed"
      ? "DROPPED"
      : s
      ? s.toUpperCase()
      : "—";

  const cls =
    s === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : s === "dropped" || s === "failed"
      ? "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400"
      : "border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300";

  return (
    <span
      className={cx(
        "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase",
        cls
      )}
    >
      {label}
    </span>
  );
}

function DuePill({ deadline }: { deadline?: string | null }) {
  if (!deadline) return null;
  const dl = new Date(deadline);
  const today = startOfToday();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);

  const isOverdue = dl < today;
  const isSoon = !isOverdue && dl <= soon;
  if (!isOverdue && !isSoon) return null;

  const cls = isOverdue
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";

  return (
    <span
      className={cx(
        "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase",
        cls
      )}
    >
      {isOverdue ? "OVERDUE" : "DUE SOON"}
    </span>
  );
}

const EXAMPLES = [
  "Ship one release every week for 12 weeks",
  "Write daily for 30 days without skipping",
  "Reach $10,000 MRR by 2026-09-01",
  "Delete social media for 12 months",
  "Run a marathon before 2026-10-01",
  "Close 10 sales by 2026-04-01",
];

const TESTIMONIALS = [
  "Helped me stay consistent for the first time in months.",
  "I stopped skipping days because there was something at stake.",
  "Simple, but brutal — in a good way.",
];

type Pulse = {
  locked: number;
  completed: number;
  dropped: number;
  dueSoon: number;
  overdue: number;
  stakesSum: number;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-[10px] tracking-[0.18em] uppercase text-zinc-400">
      {children}
    </div>
  );
}

export default function Home() {
  const registryRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);
  const organizersRef = useRef<HTMLDivElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftCommitment, setDraftCommitment] = useState("");

  const canCreateDraft = useMemo(
    () => draftTitle.trim().length >= 3 && draftCommitment.trim().length >= 8,
    [draftTitle, draftCommitment]
  );

  const [pulse, setPulse] = useState<Pulse>({
    locked: 0,
    completed: 0,
    dropped: 0,
    dueSoon: 0,
    overdue: 0,
    stakesSum: 0,
  });
  const [loadingPulse, setLoadingPulse] = useState(true);

  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("locked");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("any");
  const [withStakeOnly, setWithStakeOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [fbEmail, setFbEmail] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSending, setFbSending] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPlatform, setOrgPlatform] = useState("");
  const [orgSubmitted, setOrgSubmitted] = useState(false);
  const [orgBusy, setOrgBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });

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

  async function loadPulse() {
    setLoadingPulse(true);
    try {
      const [lockedR, completedR, droppedR] = await Promise.all([
        supabase
          .from("trajectories")
          .select("id", { count: "exact", head: true })
          .eq("is_public", true)
          .eq("status", "locked"),
        supabase
          .from("trajectories")
          .select("id", { count: "exact", head: true })
          .eq("is_public", true)
          .eq("status", "completed"),
        supabase
          .from("trajectories")
          .select("id", { count: "exact", head: true })
          .eq("is_public", true)
          .in("status", ["dropped", "failed"]),
      ]);

      const todayIso = getStartOfTodayISO();
      const soonIso = getISODatePlusDays(7);

      const dueSoonR = await supabase
        .from("trajectories")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true)
        .in("status", ["locked", "completed", "dropped", "failed"])
        .gte("deadline_at", todayIso)
        .lte("deadline_at", soonIso);

      const overdueR = await supabase
        .from("trajectories")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true)
        .in("status", ["locked", "completed", "dropped", "failed"])
        .lt("deadline_at", todayIso);

      const stakesR = await supabase
        .from("trajectories")
        .select("stake_amount")
        .eq("is_public", true)
        .not("stake_amount", "is", null)
        .limit(2000);

      const stakesSum = (stakesR.data ?? []).reduce(
        (acc: number, r: any) => acc + (Number(r.stake_amount) || 0),
        0
      );

      setPulse({
        locked: lockedR.count ?? 0,
        completed: completedR.count ?? 0,
        dropped: droppedR.count ?? 0,
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

  async function loadRegistry(p: number) {
    setLoadingList(true);

    let q = supabase
      .from("trajectories")
      .select(
        "id,title,status,created_at,locked_at,deadline_at,stake_amount,stake_currency"
      )
      .eq("is_public", true);

    if (statusFilter === "all") q = q.in("status", ["locked", "completed", "dropped", "failed"]);
    else if (statusFilter === "dropped") q = q.in("status", ["dropped", "failed"]);
    else q = q.eq("status", statusFilter);

    if (deadlineFilter === "this_week") {
      q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(7));
    } else if (deadlineFilter === "this_month") {
      q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(31));
    } else if (deadlineFilter === "expired") {
      q = q.lt("deadline_at", getStartOfTodayISO());
    }

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

  useEffect(() => {
    setPage(1);
  }, [statusFilter, deadlineFilter, withStakeOnly, sortMode]);

  useEffect(() => {
    loadPulse();
  }, []);

  useEffect(() => {
    loadRegistry(page);
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
      .insert({
        owner_id: uid,
        title,
        commitment,
        status: "draft",
        is_public: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setToast("Create error: " + error.message);
      setBusy(false);
      return;
    }

    setToast(`Draft created: ${shortId(data.id)} — go to My commitments to lock it.`);
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
        body: JSON.stringify({
          email: fbEmail.trim() || null,
          message,
          page: "/",
        }),
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

  async function submitOrganizerRequest() {
    if (orgBusy || !orgName.trim() || !orgEmail.trim()) return;

    setOrgBusy(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: orgEmail.trim(),
          message: `ORGANIZER REQUEST\nName: ${orgName.trim()}\nPlatform: ${
            orgPlatform || "not specified"
          }`,
          page: "/organizers",
        }),
      });
      setOrgSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setOrgBusy(false);
    }
  }

  const inputCls =
    "w-full border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-black/20 dark:focus:border-white/30";
  const selectCls =
    "w-full border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-black/20";

  return (
    <div className="bg-transparent text-zinc-900 dark:text-zinc-50" style={MONO}>
      <Header
        userId={userId}
        userEmail={userEmail}
        onSignIn={signIn}
        onSignOut={signOut}
        onGoRegistry={() => registryRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-0 sm:px-6 sm:pt-14">
        {/* HERO */}
        <section className="relative overflow-hidden border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-50/80 to-white dark:from-white/3 dark:to-transparent" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.025) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-8">
              <div className="mb-4 inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-zinc-400">
                <span className="inline-block h-px w-5 bg-zinc-300 dark:bg-zinc-600" />
                Anti-drift system
              </div>

              <h1
                className="text-4xl font-light leading-[1.02] tracking-tight sm:text-6xl"
                style={{ ...SERIF, fontWeight: 200 }}
              >
                You don’t quit.
                <br />
                <em style={{ fontStyle: "italic", color: ACCENT }}>You drift.</em>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                You miss one day. Then another. There’s no big decision, no dramatic collapse —
                just a slow loss of momentum until the thing you cared about disappears.
              </p>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                Lockpoint stops the drift by turning a commitment into a public record that cannot
                be edited or deleted once locked.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  "Irreversible commitments",
                  "Append-only outcomes",
                  "Public record",
                  "No silent failure",
                ].map((x) => (
                  <span
                    key={x}
                    className="border border-zinc-200 bg-white px-3 py-1 text-[10px] tracking-[0.1em] uppercase text-zinc-500 dark:border-white/10 dark:bg-white/4 dark:text-zinc-400"
                  >
                    {x}
                  </span>
                ))}
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => createRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex h-11 items-center justify-center bg-zinc-900 px-6 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  style={CLIP}
                >
                  Lock your first commitment →
                </button>

                <button
                  type="button"
                  onClick={() => registryRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex h-11 items-center justify-center border border-zinc-200 bg-white px-6 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/4 dark:text-zinc-200"
                >
                  View public registry
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-4 text-[11px] text-zinc-400">
                <Link href="/terms" className="hover:text-zinc-700 dark:hover:text-zinc-300">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-zinc-700 dark:hover:text-zinc-300">
                  Privacy
                </Link>
                <Link href="/disclaimer" className="hover:text-zinc-700 dark:hover:text-zinc-300">
                  Disclaimer
                </Link>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="border border-zinc-200 bg-zinc-50/60 p-5 dark:border-white/8 dark:bg-white/3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                  The moment of truth
                </div>
                <div
                  className="mt-3 text-2xl leading-tight text-zinc-900 dark:text-white"
                  style={{ ...SERIF, fontWeight: 250 }}
                >
                  The problem isn’t failure.
                  <br />
                  It’s the <span style={{ color: ACCENT }}>first miss.</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  That’s when everything starts slipping. Lockpoint captures that moment and makes
                  the outcome visible.
                </p>
                <div className="mt-5 border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                  Draft → Lock → Public record → Outcome later
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PAIN / SOLUTION / MECHANISM */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
            <SectionLabel>Pain</SectionLabel>
            <h2
              className="text-2xl leading-tight text-zinc-900 dark:text-white"
              style={{ ...SERIF, fontWeight: 250 }}
            >
              You don’t fail all at once.
            </h2>
            <div className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p>You stop showing up.</p>
              <p>You delay just a little.</p>
              <p>You tell yourself “tomorrow”.</p>
              <p>And suddenly it’s gone.</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              No crash. No clear break. Just quiet disengagement.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
            <SectionLabel>Solution</SectionLabel>
            <h2
              className="text-2xl leading-tight text-zinc-900 dark:text-white"
              style={{ ...SERIF, fontWeight: 250 }}
            >
              Lockpoint stops the drift.
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p>Define a commitment.</p>
              <p>Lock it publicly.</p>
              <p>Make the original record permanent.</p>
              <p>Add the outcome later.</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              No rewriting. No pretending it never happened.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
            <SectionLabel>Mechanism</SectionLabel>
            <h2
              className="text-2xl leading-tight text-zinc-900 dark:text-white"
              style={{ ...SERIF, fontWeight: 250 }}
            >
              This isn’t a habit tracker.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              This is a commitment system. You define what “showing up” means. Then you lock it.
            </p>
            <div className="mt-4 space-y-2 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              <div>→ No guessing</div>
              <div>→ No excuses</div>
              <div>→ No silent failure</div>
            </div>
          </div>
        </section>

        {/* USE CASE + SOCIAL PROOF */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 lg:col-span-7">
            <SectionLabel>Use case</SectionLabel>
            <h2
              className="text-3xl leading-tight text-zinc-900 dark:text-white"
              style={{ ...SERIF, fontWeight: 220 }}
            >
              Built for people who start strong —
              <br />
              and quietly fall off.
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {["Writing daily", "Building products", "Staying consistent"].map((x) => (
                <div
                  key={x}
                  className="border border-zinc-100 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-600 dark:border-white/6 dark:bg-white/3 dark:text-zinc-300"
                >
                  {x}
                </div>
              ))}
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              You don’t need more motivation. You need structure that doesn’t let you drift.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 lg:col-span-5">
            <SectionLabel>Early proof</SectionLabel>
            <div className="space-y-3">
              {TESTIMONIALS.map((q) => (
                <div
                  key={q}
                  className="border border-zinc-100 bg-zinc-50/60 p-4 text-sm leading-relaxed text-zinc-600 dark:border-white/6 dark:bg-white/3 dark:text-zinc-300"
                >
                  “{q}”
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CREATE + PULSE */}
        <section ref={createRef} className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Lock your first commitment
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Drafts are editable. Locking is irreversible.
                </div>
              </div>
              <Link
                href="/me"
                className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                My commitments →
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  Title
                </label>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Write every day for 30 days"
                  style={MONO}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  Commitment statement
                </label>
                <textarea
                  value={draftCommitment}
                  onChange={(e) => setDraftCommitment(e.target.value)}
                  className={inputCls}
                  rows={4}
                  placeholder={`"I will write daily for 30 days and record the outcome publicly if I stop."`}
                  style={MONO}
                />
              </div>

              <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                Once locked, the original commitment cannot be edited or deleted. Only the outcome
                can be added later.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={busy || !canCreateDraft}
                  onClick={createDraft}
                  className="h-11 bg-zinc-900 px-6 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  style={CLIP_SM}
                >
                  {busy ? "Creating…" : "Create draft →"}
                </button>

                {toast ? (
                  <div className="border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    {toast}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400">
                    Not signed in? You’ll be redirected to Google.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Registry activity
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Live counts across all public records.
                </div>
              </div>
              <button
                type="button"
                onClick={loadPulse}
                className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Refresh →
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { k: "Locked", v: pulse.locked },
                { k: "Completed", v: pulse.completed },
                { k: "Dropped", v: pulse.dropped },
                { k: "Due soon (7d)", v: pulse.dueSoon },
                { k: "Overdue", v: pulse.overdue },
                { k: "At stake", v: pulse.stakesSum ? `$${money(pulse.stakesSum)}` : "—" },
              ].map((c) => (
                <div
                  key={c.k}
                  className="border border-zinc-100 bg-zinc-50/50 px-4 py-4 dark:border-white/6 dark:bg-white/3"
                >
                  <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                    {c.k}
                  </div>
                  <div className="mt-2 text-2xl font-light" style={SERIF}>
                    {loadingPulse ? "…" : c.v}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500 dark:border-white/6 dark:bg-white/3 dark:text-zinc-400">
              Public. Permanent. Outcome recorded later.
            </div>
          </div>
        </section>

        {/* EXAMPLES */}
        <section className="mt-4 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
          <SectionLabel>Examples</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map((x) => (
              <div
                key={x}
                className="flex gap-3 border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600 dark:border-white/6 dark:bg-white/3 dark:text-zinc-300"
              >
                <span className="select-none text-zinc-300 dark:text-zinc-600">—</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </section>

        {/* REGISTRY */}
        <section
          ref={registryRef}
          className="mt-4 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4"
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Public Registry
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Public records only. Immutable once locked.
              </div>
            </div>
            <Link
              href="/me"
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              My commitments →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-9">
              {[
                {
                  label: "Status",
                  value: statusFilter,
                  set: (v: string) => setStatusFilter(v as StatusFilter),
                  opts: [
                    ["locked", "Locked"],
                    ["completed", "Completed"],
                    ["dropped", "Dropped"],
                    ["all", "All"],
                  ],
                },
                {
                  label: "Deadline",
                  value: deadlineFilter,
                  set: (v: string) => setDeadlineFilter(v as DeadlineFilter),
                  opts: [
                    ["any", "Any"],
                    ["this_week", "This week"],
                    ["this_month", "This month"],
                    ["expired", "Expired"],
                  ],
                },
                {
                  label: "Sort",
                  value: sortMode,
                  set: (v: string) => setSortMode(v as SortMode),
                  opts: [
                    ["newest", "Newest"],
                    ["recently_locked", "Recently locked"],
                    ["deadline", "Deadline first"],
                  ],
                },
              ].map(({ label, value, set, opts }) => (
                <div key={label} className="flex items-center gap-2">
                  <label className="w-20 text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                    {label}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className={cx(selectCls, "h-9")}
                    style={MONO}
                  >
                    {opts.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="lg:col-span-3">
              <button
                type="button"
                onClick={() => setWithStakeOnly((v) => !v)}
                className="flex h-9 w-full items-center justify-between border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300"
                aria-pressed={withStakeOnly}
              >
                <span>Stake only</span>
                <span
                  className={cx(
                    "inline-flex h-5 w-10 items-center border px-0.5 transition",
                    withStakeOnly
                      ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white"
                      : "border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/10"
                  )}
                >
                  <span
                    className={cx(
                      "h-3.5 w-3.5 bg-white transition dark:bg-black",
                      withStakeOnly ? "translate-x-[18px]" : "translate-x-0"
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-400">No records found.</div>
            ) : (
              items.map((t) => {
                const isLocked = String(t.status ?? "").toLowerCase() === "locked";
                return (
                  <Link
                    key={t.id}
                    href={`/t/${t.id}`}
                    className="block border border-zinc-100 bg-zinc-50/30 px-4 py-4 transition-colors hover:bg-zinc-50 dark:border-white/6 dark:bg-white/2 dark:hover:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {t.title}
                        </div>
                        <div
                          className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-400 sm:grid-cols-2"
                          style={MONO}
                        >
                          <div>{shortId(t.id)}</div>
                          <div className="sm:text-right">
                            {t.locked_at
                              ? `Locked ${fmtPrettyDate(t.locked_at)}`
                              : `Created ${fmtPrettyDate(t.created_at)}`}
                          </div>
                          <div>
                            {t.deadline_at
                              ? `Deadline ${fmtPrettyDate(t.deadline_at)}`
                              : "No deadline"}
                          </div>
                          <div className="sm:text-right">
                            {t.stake_amount != null
                              ? `Stake ${t.stake_amount}${
                                  t.stake_currency ? ` ${t.stake_currency}` : ""
                                }`
                              : "No stake"}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {isLocked && <DuePill deadline={t.deadline_at} />}
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1 || loadingList}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-black/20"
            >
              ← Prev
            </button>
            <div className="text-xs text-zinc-400">Page {page}</div>
            <button
              type="button"
              disabled={!hasMore || loadingList}
              onClick={() => setPage((p) => p + 1)}
              className="h-9 border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-black/20"
            >
              Next →
            </button>
          </div>
        </section>

        {/* ORGANIZERS */}
        <section
          ref={organizersRef}
          className="mt-12 overflow-hidden border border-zinc-200 dark:border-white/10"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-6 py-4 dark:border-white/10 dark:bg-[#0A1020]">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                For cohort organizers
              </div>
              <div className="text-sm text-white" style={{ ...SERIF, fontWeight: 300 }}>
                Catch drift before dropout
              </div>
            </div>
            <span className="border border-zinc-600 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              Early access
            </span>
          </div>

          <div className="bg-white p-6 dark:bg-[#0A1020]/60 sm:p-10">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div>
                <h2
                  className="text-3xl font-light leading-[1.08] tracking-tight sm:text-4xl"
                  style={{ ...SERIF, fontWeight: 200 }}
                >
                  Your students don’t need another reminder.
                  <br />
                  <em style={{ fontStyle: "italic", color: ACCENT }}>They need a record.</em>
                </h2>

                <p className="mt-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Every cohort has a point where momentum fades. Someone goes quiet. Then another.
                  By the time you notice, they are already out — and the group energy has shifted.
                </p>

                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  This is not only a motivation problem. It is an architecture problem. Drift is
                  free when nobody records it.
                </p>

                <div className="mt-6 border-l-2 py-1 pl-5" style={{ borderColor: ACCENT }}>
                  <div
                    className="text-sm italic leading-relaxed text-zinc-700 dark:text-zinc-200"
                    style={{ ...SERIF, fontWeight: 200 }}
                  >
                    “The first break in consistency is the earliest reliable signal of
                    disengagement.”
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                    Core insight behind organizer mode
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3">
                  {[
                    { n: "20–30", l: "Days when silent dropout often begins" },
                    { n: "$0", l: "Current cost of quietly disengaging" },
                    { n: "1st miss", l: "Earliest useful signal to catch" },
                  ].map((s) => (
                    <div key={s.n} className="border border-zinc-100 p-4 dark:border-white/8">
                      <div className="text-2xl font-light" style={{ ...SERIF, color: ACCENT }}>
                        {s.n}
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                        {s.l}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-3 text-xs uppercase tracking-[0.12em] text-zinc-400">
                    How it works
                  </div>
                  <div className="border border-zinc-100 dark:border-white/8">
                    {[
                      {
                        n: "01",
                        t: "Commit",
                        d: "Participants lock a public commitment before day one. Lockpoint records it permanently.",
                      },
                      {
                        n: "02",
                        t: "Catch drift",
                        d: "The organizer view helps surface quiet disengagement before it becomes dropout.",
                      },
                      {
                        n: "03",
                        t: "Record outcome",
                        d: "Completion builds reputation. Dropping out stays on record too.",
                      },
                    ].map((step, i) => (
                      <div
                        key={step.n}
                        className={cx(
                          "flex gap-4 p-4",
                          i < 2 ? "border-b border-zinc-100 dark:border-white/8" : ""
                        )}
                      >
                        <div className="w-6 flex-shrink-0 pt-0.5 text-[10px] tracking-[0.15em] text-zinc-300 dark:text-zinc-600">
                          {step.n}
                        </div>
                        <div>
                          <div className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                            {step.t}
                          </div>
                          <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                            {step.d}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <Link
                    href="/organizers"
                    className="inline-flex h-9 items-center gap-2 px-5 text-xs font-medium uppercase tracking-[0.08em] border"
                    style={{
                      borderColor: "rgba(0,201,138,0.3)",
                      color: "#00C98A",
                      background: "rgba(0,201,138,0.05)",
                    }}
                  >
                    View demo dashboard →
                  </Link>
                </div>
              </div>

              <div>
                <div className="border border-zinc-200 bg-zinc-50/50 p-6 dark:border-white/10 dark:bg-white/3">
                  {!orgSubmitted ? (
                    <>
                      <div className="mb-1 text-sm" style={{ ...SERIF, fontWeight: 300 }}>
                        Request early access
                      </div>
                      <div className="mb-6 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Talking to early cohort organizers before building the full B2B layer.
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                            Your name
                          </label>
                          <input
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className={inputCls}
                            placeholder="Alex"
                            style={MONO}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                            Email
                          </label>
                          <input
                            type="email"
                            value={orgEmail}
                            onChange={(e) => setOrgEmail(e.target.value)}
                            className={inputCls}
                            placeholder="you@example.com"
                            style={MONO}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                            Platform (optional)
                          </label>
                          <select
                            value={orgPlatform}
                            onChange={(e) => setOrgPlatform(e.target.value)}
                            className={cx(selectCls, "py-2.5")}
                            style={MONO}
                          >
                            <option value="">Select platform</option>
                            <option>Maven</option>
                            <option>Skool</option>
                            <option>Kajabi</option>
                            <option>Teachable</option>
                            <option>Circle</option>
                            <option>Custom / other</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={orgBusy || !orgName.trim() || !orgEmail.trim()}
                          onClick={submitOrganizerRequest}
                          className="mt-2 h-11 w-full bg-zinc-900 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00C98A] dark:text-black dark:hover:opacity-90"
                          style={CLIP}
                        >
                          {orgBusy ? "Sending…" : "Request conversation →"}
                        </button>

                        <div className="text-center text-[10px] leading-relaxed text-zinc-400">
                          No spam. No sequence. A real reply from the founder.
                        </div>
                      </div>

                      <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-white/8">
                        <div className="mb-3 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                          What you get
                        </div>
                        <div className="space-y-2">
                          {[
                            "30-min call with the founder",
                            "First access to the organizer MVP",
                            "Direct input on what gets built",
                            "Free for early access cohorts",
                            "Works with Maven, Kajabi, or custom platforms",
                          ].map((f) => (
                            <div
                              key={f}
                              className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400"
                            >
                              <span style={{ color: ACCENT }}>→</span>
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="mb-3 text-2xl font-light" style={{ ...SERIF, color: ACCENT }}>
                        Recorded.
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        You’ll hear from me within 48 hours.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEEDBACK */}
        <section className="mb-10 mt-4 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Feedback</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Tell me what broke or what you want next.
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                Email (optional)
              </label>
              <input
                value={fbEmail}
                onChange={(e) => setFbEmail(e.target.value)}
                className={inputCls}
                placeholder="you@email.com"
                style={MONO}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                Message
              </label>
              <textarea
                value={fbMsg}
                onChange={(e) => setFbMsg(e.target.value)}
                className={inputCls}
                rows={4}
                placeholder="Feedback, ideas, collaboration — anything."
                style={MONO}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={!fbMsg.trim() || fbSending}
              onClick={sendFeedback}
              className="h-11 bg-zinc-900 px-6 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              style={CLIP_SM}
            >
              {fbSending ? "Sending…" : "Send feedback →"}
            </button>

            {toast && <div className="text-xs text-zinc-400">{toast}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
