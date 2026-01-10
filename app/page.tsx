"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

function toISODateString(d: Date) {
  // yyyy-mm-dd
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HomePage() {
  const [toast, setToast] = useState<string | null>(null);

  // Auth
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const authed = !!session?.user;

  // Draft inputs
  const [busy, setBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCommitment, setDraftCommitment] = useState("");
  const [draftDeadline, setDraftDeadline] = useState<string>(""); // yyyy-mm-dd

  // Registry
  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Feedback form
  const [fbBusy, setFbBusy] = useState(false);
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbMessage, setFbMessage] = useState("");

  const canCreateDraft = useMemo(() => {
    const t = draftTitle.trim();
    const c = draftCommitment.trim();
    return t.length >= 3 && c.length >= 8;
  }, [draftTitle, draftCommitment]);

  const canSendFeedback = useMemo(() => {
    const m = fbMessage.trim();
    const e = fbEmail.trim();
    // email optional, but if provided should look like email
    const emailOk = !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    return m.length >= 5 && emailOk;
  }, [fbMessage, fbEmail]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadLatest() {
    setLoadingList(true);
    setToast(null);

    const { data, error } = await supabase
      .from("trajectories")
      .select("id,title,commitment,status,created_at,locked_at,dropped_at,deadline_at")
      .in("status", ["locked", "completed", "failed"])
      .order("locked_at", { ascending: false, nullsFirst: false })
      .limit(12);

    if (error) {
      console.error(error);
      setToast("Error loading registry: " + error.message);
      setItems([]);
      setLoadingList(false);
      return;
    }

    setItems((data ?? []) as Trajectory[]);
    setLoadingList(false);
  }

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInGoogle() {
    setToast(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/me` },
    });
  }

  async function signOut() {
    setToast(null);
    const { error } = await supabase.auth.signOut();
    if (error) setToast("Sign out error: " + error.message);
  }

  async function createTrajectory() {
    if (busy) return;
    setBusy(true);
    setToast(null);

    const title = draftTitle.trim();
    const commitment = draftCommitment.trim();

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

    const uid = session?.user?.id;
    if (!uid) {
      setToast("Please sign in to create drafts.");
      setBusy(false);
      await signInGoogle();
      return;
    }

    const deadline_at =
      draftDeadline?.trim()
        ? new Date(`${draftDeadline}T00:00:00`).toISOString()
        : null;

    const { data, error } = await supabase
      .from("trajectories")
      .insert({
        owner_id: uid,
        title,
        commitment,
        status: "draft",
        summary: null,
        deadline_at,
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setToast("Create error: " + error.message);
      setBusy(false);
      return;
    }

    setDraftTitle("");
    setDraftCommitment("");
    setDraftDeadline("");
    setBusy(false);

    // Draft created on Home → manage actions in cabinet
    window.location.href = "/me";
  }

  async function sendFeedback() {
    if (fbBusy) return;
    setFbBusy(true);
    setToast(null);

    const payload = {
      name: fbName.trim() || null,
      email: fbEmail.trim() || null,
      message: fbMessage.trim(),
      page: "home",
      created_at: new Date().toISOString(),
    };

    if (!payload.message || payload.message.length < 5) {
      setToast("Feedback message is too short.");
      setFbBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setFbName("");
      setFbEmail("");
      setFbMessage("");
      setToast("Feedback sent. Thank you.");
    } catch (e: any) {
      console.error(e);
      setToast(
        "Feedback error. If /api/feedback is not set up yet, create it (I can generate it next)."
      );
    } finally {
      setFbBusy(false);
    }
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

  const minDeadline = useMemo(() => {
    const today = new Date();
    return toISODateString(today);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">Lockpoint</h1>
            <p className="mt-3 text-lg leading-8 text-zinc-700 dark:text-zinc-200">
              <strong>Where decisions become irreversible futures.</strong>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/me"
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              My cabinet →
            </Link>

            {authReady ? (
              authed ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInGoogle}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  Sign in (Google)
                </button>
              )
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">…</div>
            )}
          </div>
        </div>

        <p className="mt-6 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          Create a draft trajectory. When you’re ready, go to your cabinet to lock it.
          After lock: <strong>no edits</strong>, <strong>no deletes</strong> — <strong>amendments only</strong>.
        </p>

        {/* Rule block */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex gap-4">
            <div className="w-1 rounded-full bg-zinc-900 dark:bg-white" />
            <div>
              <div className="text-xl font-semibold leading-snug tracking-tight">
                {SYSTEM_FORMULA}
              </div>
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

        {/* Create draft */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Create draft</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Drafts are editable. Locking happens in your cabinet.
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

          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Deadline (optional)
            </label>
            <input
              type="date"
              min={minDeadline}
              value={draftDeadline}
              onChange={(e) => setDraftDeadline(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
            />
            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              If set, it appears in your cabinet and in the public record after lock.
            </div>
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
              {busy ? "Creating…" : "Create draft → go to cabinet"}
            </button>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              After creating, you’ll manage (LOCK/Outcome) in <span className="font-semibold">My cabinet</span>.
            </div>
          </div>
        </div>

        {/* Registry */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Public registry</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Locked records and outcomes. Immutable.
              </div>
            </div>

            <button
              type="button"
              onClick={loadLatest}
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              title="Refresh"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No locked records yet.</div>
            ) : (
              items.map((t) => {
                const status = String(t.status || "").toLowerCase();
                const isFinal = status === "completed" || status === "failed";

                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.title}</div>

                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="font-mono">{shortId(t.id)}</span>
                          {" · "}
                          <span className="uppercase tracking-wide">
                            {status ? status.toUpperCase() : "—"}
                          </span>
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
                          title="Open public immutable view"
                        >
                          Open
                        </Link>

                        {!isFinal ? (
                          <Link
                            href="/me"
                            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                            title="Manage in cabinet"
                          >
                            Manage
                          </Link>
                        ) : (
                          <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                            Final
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Feedback */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Feedback</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Tell me what feels broken, confusing, or missing. Short and direct is best.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Name (optional)</label>
              <input
                value={fbName}
                onChange={(e) => setFbName(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                placeholder="Andriy"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Email (optional)</label>
              <input
                value={fbEmail}
                onChange={(e) => setFbEmail(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Message</label>
            <textarea
              value={fbMessage}
              onChange={(e) => setFbMessage(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              rows={4}
              placeholder="What should be different?"
            />
          </div>

          <div className="mt-4">
            <button
              type="button"
              disabled={fbBusy || !canSendFeedback}
              onClick={sendFeedback}
              className="h-11 w-full rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {fbBusy ? "Sending…" : "Send feedback"}
            </button>

            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              If feedback endpoint is not set up yet, I’ll generate <span className="font-mono">/api/feedback</span> next.
            </div>
          </div>
        </div>

        {toast && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
