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

  // Public registry
  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Feedback form (simple)
  const [fbEmail, setFbEmail] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSent, setFbSent] = useState(false);

 async function loadLatest() {
  setLoadingList(true);

  const { data, error } = await supabase
    .from("trajectories")
    .select("id,title,commitment,status,created_at,locked_at,deadline_at")
    .eq("is_public", true)
    .in("status", ["locked", "completed", "failed"])
    .order("locked_at", { ascending: false, nullsFirst: false })
    .limit(12);

  if (error) {
    console.error(error);
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

  async function submitFeedback() {
    setFbSent(false);
    if (!fbMsg.trim()) return;

    // Minimal: store to console for now, replace with API/email later
    console.log("Feedback:", { email: fbEmail.trim() || null, message: fbMsg.trim() });
    setFbEmail("");
    setFbMsg("");
    setFbSent(true);
  }

const EXAMPLES = [
   Life
  "Delete all social media for 12 months",
  "Run a marathon before 2026-10-01",
  "No alcohol for 180 days",
  "Read 50 books in 2026",

   Business
  "Launch a product and make 10 sales by 2026-04-01",
  "Reach $10,000 monthly revenue by 2026-09-01",
  "Ship one release every week for 12 weeks",
  "Sign 3 paying B2B clients by 2026-03-31",

   Finance
  "Save $5,000 cash by 2026-06-30",
  "Pay off $2,000 of debt by 2026-05-01",
];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-16">
        <h1 className="text-4xl font-semibold tracking-tight">Lockpoint</h1>
        <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-200">
          <strong>Where decisions become irreversible futures.</strong>
        </p>
<Link
  href="/onboarding"
  className="mt-3 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
>
  What is Lockpoint?
</Link>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/me"
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            My cabinet →
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Create drafts + lock + outcomes
          </span>
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
          <div className="text-sm font-semibold">Registry (public)</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Shows only locked and finalized records.
          </div>

          <div className="mt-4 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No records yet.</div>
            ) : (
              items.map((t) => (
                <Link
                  key={t.id}
                  href={`/t/${t.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white px-3 py-3 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
                >
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono">{shortId(t.id)}</span>
                    {" · "}
                    <span className="uppercase">{String(t.status ?? "").toUpperCase()}</span>
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
                </Link>
              ))
            )}
          </div>
        </div>
        {/* Feedback */}
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Feedback</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Tell me what broke or what you want next.
          </div>

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
            onClick={() => {
              const subject = encodeURIComponent("Lockpoint feedback");
              const body = encodeURIComponent(
                `From: ${fbEmail || "(not provided)"}\n\nMessage:\n${fbMsg || ""}`
              );
              window.location.href =
                "mailto:a.lutsyna@gmail.com?subject=" +
                subject +
                "&body=" +
                body;
              setFbSent(true);
            }}
            className="mt-4 h-11 rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            Send
          </button>

          {fbSent ? (
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Sent. Thank you.
            </div>
          ) : null}
        </div>

      </main>
    </div>
  );
}
