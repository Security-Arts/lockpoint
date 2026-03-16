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
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return String(iso); }
}
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function getISODatePlusDays(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString(); }
function getStartOfTodayISO() { return startOfToday().toISOString(); }
function money(n: number) { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n); } catch { return String(n); } }

const MONO = { fontFamily: "var(--font-dm-mono), monospace" };
const SERIF = { fontFamily: "var(--font-fraunces), serif" };
const ACCENT = "#00C98A";
const CLIP = { clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" };
const CLIP_SM = { clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))" };

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status ?? "").toLowerCase();
  const label = s === "locked" ? "LOCKED" : s === "completed" ? "COMPLETED" : s === "dropped" || s === "failed" ? "DROPPED" : s ? s.toUpperCase() : "—";
  const cls = s === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    : s === "dropped" || s === "failed" ? "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400"
    : "border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300";
  return <span className={cx("inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase", cls)}>{label}</span>;
}

function DuePill({ deadline }: { deadline?: string | null }) {
  if (!deadline) return null;
  const dl = new Date(deadline); const today = startOfToday(); const soon = new Date(today); soon.setDate(soon.getDate() + 7);
  const isOverdue = dl < today; const isSoon = !isOverdue && dl <= soon;
  if (!isOverdue && !isSoon) return null;
  const cls = isOverdue ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  return <span className={cx("inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase", cls)}>{isOverdue ? "OVERDUE" : "DUE SOON"}</span>;
}

const EXAMPLES = [
  "Ship one release every week for 12 weeks",
  "Make 10 sales by 2026-04-01",
  "Reach $10,000 monthly revenue by 2026-09-01",
  "Quit alcohol for 180 days",
  "Delete social media for 12 months",
  "Run a marathon before 2026-10-01",
];

type Pulse = { locked: number; completed: number; dropped: number; dueSoon: number; overdue: number; stakesSum: number; };

export default function Home() {
  const registryRef = useRef<HTMLDivElement | null>(null);
  const organizersRef = useRef<HTMLDivElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCommitment, setDraftCommitment] = useState("");
  const canCreateDraft = useMemo(() => draftTitle.trim().length >= 3 && draftCommitment.trim().length >= 8, [draftTitle, draftCommitment]);

  const [pulse, setPulse] = useState<Pulse>({ locked: 0, completed: 0, dropped: 0, dueSoon: 0, overdue: 0, stakesSum: 0 });
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

  // Organizers form
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPlatform, setOrgPlatform] = useState("");
  const [orgSubmitted, setOrgSubmitted] = useState(false);
  const [orgBusy, setOrgBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => { if (!mounted) return; setUserId(data.user?.id ?? null); setUserEmail(data.user?.email ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => { setUserId(session?.user?.id ?? null); setUserEmail(session?.user?.email ?? null); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  async function signIn() { setToast(null); await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/me` } }); }
  async function signOut() { setToast(null); await supabase.auth.signOut(); setToast("Signed out."); }

  async function loadPulse() {
    setLoadingPulse(true);
    try {
const [lockedR, completedR, droppedR] = await Promise.all([
  supabase.from("trajectories").select("id", { count: "exact", head: true }).eq("is_public", true).eq("status", "locked"),
  supabase.from("trajectories").select("id", { count: "exact", head: true }).eq("is_public", true).eq("status", "completed"),
  supabase.from("trajectories").select("id", { count: "exact", head: true }).eq("is_public", true).in("status", ["dropped", "failed"]),
]);
      const todayIso = getStartOfTodayISO(); const soonIso = getISODatePlusDays(7);
      const dueSoonR = await supabase.from("trajectories").select("id", { count: "exact", head: true }).eq("is_public", true).in("status", ["locked","completed","dropped","failed"]).gte("deadline_at", todayIso).lte("deadline_at", soonIso);
      const overdueR = await supabase.from("trajectories").select("id", { count: "exact", head: true }).eq("is_public", true).in("status", ["locked","completed","dropped","failed"]).lt("deadline_at", todayIso);
      const stakesR = await supabase.from("trajectories").select("stake_amount").eq("is_public", true).not("stake_amount", "is", null).limit(2000);
      const stakesSum = (stakesR.data ?? []).reduce((acc: number, r: any) => acc + (Number(r.stake_amount) || 0), 0);
      setPulse({ locked: lockedR.count ?? 0, completed: completedR.count ?? 0, dropped: droppedR.count ?? 0, dueSoon: dueSoonR.count ?? 0, overdue: overdueR.count ?? 0, stakesSum });
    } catch (e) { console.error(e); } finally { setLoadingPulse(false); }
  }

  async function loadRegistry(p: number) {
    setLoadingList(true);
    let q = supabase.from("trajectories").select("id,title,status,created_at,locked_at,deadline_at,stake_amount,stake_currency").eq("is_public", true);
    if (statusFilter === "all") q = q.in("status", ["locked","completed","dropped","failed"]);
    else if (statusFilter === "dropped") q = q.in("status", ["dropped","failed"]);
    else q = q.eq("status", statusFilter);
    if (deadlineFilter === "this_week") q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(7));
    else if (deadlineFilter === "this_month") q = q.gte("deadline_at", getStartOfTodayISO()).lte("deadline_at", getISODatePlusDays(31));
    else if (deadlineFilter === "expired") q = q.lt("deadline_at", getStartOfTodayISO());
    if (withStakeOnly) q = q.not("stake_amount", "is", null);
    if (sortMode === "deadline") q = q.order("deadline_at", { ascending: true, nullsFirst: false });
    else if (sortMode === "recently_locked") q = q.order("locked_at", { ascending: false, nullsFirst: false });
    else q = q.order("locked_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    const from = (p - 1) * PAGE_SIZE; const to = from + PAGE_SIZE;
    const { data, error } = await q.range(from, to);
    if (error) { console.error(error); setItems([]); setHasMore(false); setLoadingList(false); return; }
    const rows = (data ?? []) as Trajectory[];
    setHasMore(rows.length > PAGE_SIZE); setItems(rows.slice(0, PAGE_SIZE)); setLoadingList(false);
  }

  useEffect(() => { setPage(1); }, [statusFilter, deadlineFilter, withStakeOnly, sortMode]);
  useEffect(() => { loadPulse(); }, []);
  useEffect(() => { loadRegistry(page); }, [page, statusFilter, deadlineFilter, withStakeOnly, sortMode]);

  async function createDraft() {
    if (busy) return; setBusy(true); setToast(null);
    const title = draftTitle.trim(); const commitment = draftCommitment.trim();
    if (!canCreateDraft) { setToast("Title ≥ 3 chars, commitment ≥ 8 chars."); setBusy(false); return; }
    const { data: u } = await supabase.auth.getUser(); const uid = u.user?.id;
    if (!uid) { setToast("Please sign in to create drafts."); setBusy(false); await new Promise(r => setTimeout(r, 250)); await signIn(); return; }
    const { data, error } = await supabase.from("trajectories").insert({ owner_id: uid, title, commitment, status: "draft", is_public: false }).select("id").single();
    if (error) { console.error(error); setToast("Create error: " + error.message); setBusy(false); return; }
    setToast(`Draft created: ${shortId(data.id)} — go to My commitments to lock it.`);
    setDraftTitle(""); setDraftCommitment(""); setBusy(false);
  }

  async function sendFeedback() {
    if (fbSending) return; const message = fbMsg.trim(); if (!message) return; setFbSending(true); setToast(null);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: fbEmail.trim() || null, message, page: "/" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setToast(j?.error ? `Feedback failed: ${j.error}` : "Feedback failed."); setFbSending(false); return; }
      setFbEmail(""); setFbMsg(""); setToast("Sent. Thank you.");
    } catch (e) { console.error(e); setToast("Feedback failed."); } finally { setFbSending(false); }
  }

  async function submitOrganizerRequest() {
    if (orgBusy || !orgName.trim() || !orgEmail.trim()) return;
    setOrgBusy(true);
    try {
      await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: orgEmail.trim(), message: `ORGANIZER REQUEST\nName: ${orgName.trim()}\nPlatform: ${orgPlatform || "not specified"}`, page: "/organizers" }) });
      setOrgSubmitted(true);
    } catch (e) { console.error(e); } finally { setOrgBusy(false); }
  }

  const inputCls = "w-full border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-black/20 dark:focus:border-white/30";
  const selectCls = "w-full border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-white/10 dark:bg-black/20";

  return (
    <div className="bg-transparent text-zinc-900 dark:text-zinc-50" style={MONO}>
      <Header userId={userId} userEmail={userEmail} onSignIn={signIn} onSignOut={signOut} onGoRegistry={() => registryRef.current?.scrollIntoView({ behavior: "smooth" })} />

      <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-0 sm:px-6 sm:pt-14">

        {/* HERO */}
        <section className="relative overflow-hidden border border-zinc-200 bg-white dark:border-white/8 dark:bg-white/4 p-6 sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-50/80 to-white dark:from-white/3 dark:to-transparent" />
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.025) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-8">
              <div className="mb-4 inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-zinc-400">
                <span className="inline-block w-5 h-px bg-zinc-300 dark:bg-zinc-600" />
                Public Commitment Registry
              </div>
              <h1 className="text-4xl font-light leading-[1.08] tracking-tight sm:text-5xl" style={{ ...SERIF, fontWeight: 200 }}>
                Lock a commitment.<br />
                <em style={{ fontStyle: "italic", color: ACCENT }}>The record stays.</em>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                Lockpoint is a public registry for irreversible commitments. Once locked, the original record cannot be edited or deleted. Only outcomes can be appended after.
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Lockpoint does not plan, remind, or motivate. It records what you committed to — and what happened.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Locked forever","Append-only","Publicly searchable","No deletions"].map(x => (
                  <span key={x} className="border border-zinc-200 bg-white px-3 py-1 text-[10px] tracking-[0.1em] uppercase text-zinc-500 dark:border-white/10 dark:bg-white/4 dark:text-zinc-400">{x}</span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 text-[11px] text-zinc-400">
                <Link href="/terms" className="hover:text-zinc-700 dark:hover:text-zinc-300">Terms</Link>
                <Link href="/privacy" className="hover:text-zinc-700 dark:hover:text-zinc-300">Privacy</Link>
                <Link href="/disclaimer" className="hover:text-zinc-700 dark:hover:text-zinc-300">Disclaimer</Link>
              </div>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              <div className="flex flex-col gap-3 lg:items-end">
                <Link href="/me" className="inline-flex h-11 w-full items-center justify-center bg-zinc-900 px-6 text-xs tracking-[0.1em] uppercase font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 lg:w-auto" style={CLIP}>Create a commitment →</Link>
                <button type="button" onClick={() => registryRef.current?.scrollIntoView({ behavior: "smooth" })} className="inline-flex h-11 w-full items-center justify-center border border-zinc-200 bg-white px-6 text-xs tracking-[0.1em] uppercase font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/4 dark:text-zinc-200 lg:w-auto">View registry</button>
                <button type="button" onClick={() => organizersRef.current?.scrollIntoView({ behavior: "smooth" })} className="inline-flex h-11 w-full items-center justify-center border border-zinc-200 bg-zinc-50 px-6 text-xs tracking-[0.1em] uppercase font-semibold text-zinc-500 hover:bg-zinc-100 dark:border-white/8 dark:bg-white/3 dark:text-zinc-400 lg:w-auto">For organizers →</button>
                <div className="text-[10px] tracking-[0.08em] text-zinc-400 lg:text-right">Drafts → Lock → Outcomes</div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY PERMANENCE */}
        <section className="mt-4 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
          <div className="text-xs tracking-[0.15em] uppercase text-zinc-400 mb-4">Why permanence works.</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Editability kills seriousness", d: "If it can be rewritten, it was never real." },
              { t: "Public memory creates pressure", d: "A commitment anyone can see is a commitment you keep." },
              { t: "Outcomes don't disappear", d: "Completing or dropping — both are honest records." },
              { t: "Changed your mind after locking?", d: "Drop it. Declare why. The record of dropping is as honest as the record of completing." },
              { t: "Nobody will remember in a month.", d: "The record will." },
            ].map(x => (
              <div key={x.t} className="border border-zinc-100 bg-zinc-50/60 p-4 dark:border-white/6 dark:bg-white/3">
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{x.t}</div>
                <div className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{x.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CREATE + PULSE */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Create a commitment draft</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Drafts are editable. Locking is irreversible.</div>
              </div>
              <Link href="/me" className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">My commitments →</Link>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Title</label>
                <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} className={inputCls} placeholder="e.g. No social media for 12 months" style={MONO} />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Commitment statement</label>
                <textarea value={draftCommitment} onChange={e => setDraftCommitment(e.target.value)} className={inputCls} rows={4} placeholder={`"I will delete all social media by 2026-02-01 and not return for 12 months."`} style={MONO} />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" disabled={busy || !canCreateDraft} onClick={createDraft} className="h-11 bg-zinc-900 px-6 text-xs tracking-[0.1em] uppercase font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200" style={CLIP_SM}>
                  {busy ? "Creating…" : "Create draft →"}
                </button>
                {toast ? <div className="border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">{toast}</div>
                  : <div className="text-xs text-zinc-400">Not signed in? You'll be redirected to Google.</div>}
              </div>
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4 lg:col-span-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Registry activity</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Live counts across all public records.</div>
              </div>
              <button type="button" onClick={loadPulse} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Refresh →</button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { k: "Locked", v: pulse.locked }, { k: "Completed", v: pulse.completed }, { k: "Dropped", v: pulse.dropped },
                { k: "Due soon (7d)", v: pulse.dueSoon }, { k: "Overdue", v: pulse.overdue },
                { k: "At stake", v: pulse.stakesSum ? `$${money(pulse.stakesSum)}` : "—" },
              ].map(c => (
                <div key={c.k} className="border border-zinc-100 bg-zinc-50/50 px-4 py-4 dark:border-white/6 dark:bg-white/3">
                  <div className="text-[10px] tracking-[0.12em] uppercase text-zinc-400">{c.k}</div>
                  <div className="mt-2 text-2xl font-light" style={SERIF}>{loadingPulse ? "…" : c.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500 dark:border-white/6 dark:bg-white/3 dark:text-zinc-400">Public. Permanent. Outcomes recorded.</div>
          </div>
        </section>

        {/* EXAMPLES */}
        <section className="mt-4 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
          <div className="text-xs tracking-[0.15em] uppercase text-zinc-400 mb-4">Examples</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map(x => (
              <div key={x} className="flex gap-3 border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600 dark:border-white/6 dark:bg-white/3 dark:text-zinc-300">
                <span className="select-none text-zinc-300 dark:text-zinc-600">—</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </section>

        {/* REGISTRY */}
        <section ref={registryRef} className="mt-4 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Public Registry</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Public records only. Immutable once locked.</div>
            </div>
            <Link href="/me" className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">My commitments →</Link>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-9 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Status", value: statusFilter, set: (v: string) => setStatusFilter(v as StatusFilter), opts: [["locked","Locked"],["completed","Completed"],["dropped","Dropped"],["all","All"]] },
                { label: "Deadline", value: deadlineFilter, set: (v: string) => setDeadlineFilter(v as DeadlineFilter), opts: [["any","Any"],["this_week","This week"],["this_month","This month"],["expired","Expired"]] },
                { label: "Sort", value: sortMode, set: (v: string) => setSortMode(v as SortMode), opts: [["newest","Newest"],["recently_locked","Recently locked"],["deadline","Deadline first"]] },
              ].map(({ label, value, set, opts }) => (
                <div key={label} className="flex items-center gap-2">
                  <label className="w-20 text-[10px] tracking-[0.1em] uppercase text-zinc-400">{label}</label>
                  <select value={value} onChange={e => set(e.target.value)} className={cx(selectCls, "h-9")} style={MONO}>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="lg:col-span-3">
              <button type="button" onClick={() => setWithStakeOnly(v => !v)} className="flex h-9 w-full items-center justify-between border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300" aria-pressed={withStakeOnly}>
                <span>Stake only</span>
                <span className={cx("inline-flex h-5 w-10 items-center border px-0.5 transition", withStakeOnly ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white" : "border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/10")}>
                  <span className={cx("h-3.5 w-3.5 bg-white transition dark:bg-black", withStakeOnly ? "translate-x-[18px]" : "translate-x-0")} />
                </span>
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {loadingList ? <div className="text-sm text-zinc-400">Loading…</div>
              : items.length === 0 ? <div className="text-sm text-zinc-400">No records found.</div>
              : items.map(t => {
                const isLocked = String(t.status ?? "").toLowerCase() === "locked";
                return (
                  <Link key={t.id} href={`/t/${t.id}`} className="block border border-zinc-100 bg-zinc-50/30 px-4 py-4 hover:bg-zinc-50 dark:border-white/6 dark:bg-white/2 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{t.title}</div>
                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-400 sm:grid-cols-2" style={MONO}>
                          <div>{shortId(t.id)}</div>
                          <div className="sm:text-right">{t.locked_at ? `Locked ${fmtPrettyDate(t.locked_at)}` : `Created ${fmtPrettyDate(t.created_at)}`}</div>
                          <div>{t.deadline_at ? `Deadline ${fmtPrettyDate(t.deadline_at)}` : "No deadline"}</div>
                          <div className="sm:text-right">{t.stake_amount != null ? `Stake ${t.stake_amount}${t.stake_currency ? ` ${t.stake_currency}` : ""}` : "No stake"}</div>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {isLocked && <DuePill deadline={t.deadline_at} />}
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button type="button" disabled={page <= 1 || loadingList} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-9 border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/10 dark:bg-black/20">← Prev</button>
            <div className="text-xs text-zinc-400">Page {page}</div>
            <button type="button" disabled={!hasMore || loadingList} onClick={() => setPage(p => p + 1)} className="h-9 border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/10 dark:bg-black/20">Next →</button>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            ORGANIZERS SECTION
        ═══════════════════════════════════════ */}
        <section ref={organizersRef} className="mt-12 border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="border-b border-zinc-200 dark:border-white/10 bg-zinc-900 dark:bg-[#0A1020] px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-1">For cohort organizers</div>
              <div className="text-white text-sm" style={{ ...SERIF, fontWeight: 300 }}>Lockpoint for cohorts</div>
            </div>
            <span className="text-[10px] tracking-[0.12em] uppercase border border-zinc-600 text-zinc-400 px-2 py-1">Early access</span>
          </div>

          <div className="bg-white dark:bg-[#0A1020]/60 p-6 sm:p-10">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">

              {/* LEFT */}
              <div>
                <h2 className="text-3xl font-light leading-[1.1] tracking-tight sm:text-4xl" style={{ ...SERIF, fontWeight: 200 }}>
                  Your students don't need another reminder.<br />
                  <em style={{ fontStyle: "italic", color: ACCENT }}>They need to be recorded.</em>
                </h2>
                <p className="mt-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Every cohort has a day 20–30. Initial motivation is gone, the habit hasn't formed yet. Someone goes quiet. Then another. By the time you notice, they're already out — and the group energy has shifted.</p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">This isn't a motivation problem. It's an architecture problem. Dropout is free. No record, no consequence, no one whose opinion they value actually noticed.</p>

                <div className="mt-6 border-l-2 pl-5 py-1" style={{ borderColor: ACCENT }}>
                  <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 italic" style={{ ...SERIF, fontWeight: 200 }}>
                    "The product isn't the witness. It's the infrastructure that protects the witness from going passive."
                  </div>
                  <div className="mt-2 text-[10px] tracking-[0.12em] uppercase text-zinc-400">Tekelpath — accountability coach, 101-day programs</div>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3">
                  {[
                    { n: "20–30", l: "Days when most participants silently exit" },
                    { n: "$0", l: "Current cost of going quiet mid-cohort" },
                    { n: "0", l: "Organizers who see drift before dropout" },
                  ].map(s => (
                    <div key={s.n} className="border border-zinc-100 dark:border-white/8 p-4">
                      <div className="text-2xl font-light" style={{ ...SERIF, color: ACCENT }}>{s.n}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">{s.l}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="text-xs tracking-[0.12em] uppercase text-zinc-400 mb-3">How it works</div>
                  <div className="border border-zinc-100 dark:border-white/8">
                    {[
                      { n: "01", t: "Commit", d: "Before day one, every participant signs a public irreversible commitment — what they'll do, what's at stake. Lockpoint records it permanently." },
                      { n: "02", t: "Witness", d: "Your organizer dashboard surfaces silence patterns. Day 20–30 flagged automatically. You see drift before it becomes dropout." },
                      { n: "03", t: "Record", d: "Completion builds a track record. Dropout is on record too. Going quiet stops being free." },
                    ].map((step, i) => (
                      <div key={step.n} className={cx("flex gap-4 p-4", i < 2 ? "border-b border-zinc-100 dark:border-white/8" : "")}>
                        <div className="text-[10px] tracking-[0.15em] text-zinc-300 dark:text-zinc-600 w-6 flex-shrink-0 pt-0.5">{step.n}</div>
                        <div>
                          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{step.t}</div>
                          <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{step.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Dashboard demo link */}
                <div className="mt-4">
                  <Link
                    href="/organizers"
                    className="inline-flex items-center gap-2 h-9 px-5 text-xs tracking-[0.08em] uppercase font-medium border"
                    style={{ borderColor: "rgba(0,201,138,0.3)", color: "#00C98A", background: "rgba(0,201,138,0.05)" }}
                  >
                    View demo dashboard →
                  </Link>
                </div>

              {/* RIGHT: form */}
              <div>
                <div className="border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/3 p-6">
                  {!orgSubmitted ? (
                    <>
                      <div className="text-sm mb-1" style={{ ...SERIF, fontWeight: 300 }}>Request early access</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">We're talking to 10 cohort organizers before writing a line of B2B code. No pitch — a 30-minute conversation about whether dropout is real for you.</div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Your name</label>
                          <input value={orgName} onChange={e => setOrgName(e.target.value)} className={inputCls} placeholder="Alex" style={MONO} />
                        </div>
                        <div>
                          <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Email</label>
                          <input type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} className={inputCls} placeholder="you@example.com" style={MONO} />
                        </div>
                        <div>
                          <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Platform (optional)</label>
                          <select value={orgPlatform} onChange={e => setOrgPlatform(e.target.value)} className={cx(selectCls, "py-2.5")} style={MONO}>
                            <option value="">Select platform</option>
                            <option>Maven</option><option>Skool</option><option>Kajabi</option><option>Teachable</option><option>Circle</option><option>Custom / other</option>
                          </select>
                        </div>
                        <button type="button" disabled={orgBusy || !orgName.trim() || !orgEmail.trim()} onClick={submitOrganizerRequest} className="mt-2 w-full h-11 bg-zinc-900 text-white text-xs tracking-[0.1em] uppercase font-semibold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#00C98A] dark:text-black dark:hover:opacity-90" style={CLIP}>
                          {orgBusy ? "Sending…" : "Request conversation →"}
                        </button>
                        <div className="text-[10px] text-zinc-400 text-center leading-relaxed">No spam. No sequences. A real reply from the founder.</div>
                      </div>
                      <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-white/8">
                        <div className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 mb-3">What you get</div>
                        <div className="space-y-2">
                          {["30-min call with the founder","First access to the MVP","Direct input on what gets built","Free for early access cohorts","Works with Maven, Kajabi, or custom platforms"].map(f => (
                            <div key={f} className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                              <span style={{ color: ACCENT }}>→</span><span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="text-2xl font-light mb-3" style={{ ...SERIF, color: ACCENT }}>Recorded.</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">You'll hear from me within 48 hours.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEEDBACK */}
        <section className="mt-4 mb-10 border border-zinc-200 bg-white p-6 dark:border-white/8 dark:bg-white/4">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Feedback</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Tell me what broke or what you want next.</div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Email (optional)</label>
              <input value={fbEmail} onChange={e => setFbEmail(e.target.value)} className={inputCls} placeholder="you@email.com" style={MONO} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">Message</label>
              <textarea value={fbMsg} onChange={e => setFbMsg(e.target.value)} className={inputCls} rows={4} placeholder="Feedback, ideas, collaboration — anything." style={MONO} />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" disabled={!fbMsg.trim() || fbSending} onClick={sendFeedback} className="h-11 bg-zinc-900 px-6 text-xs tracking-[0.1em] uppercase font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200" style={CLIP_SM}>
              {fbSending ? "Sending…" : "Send feedback →"}
            </button>
            {toast && <div className="text-xs text-zinc-400">{toast}</div>}
          </div>
        </section>

      </main>
    </div>
  );
}
