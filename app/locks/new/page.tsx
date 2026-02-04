"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

function deadlineToISO(dtLocal: string) {
  if (!dtLocal) return null;
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function NewLockPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [commitment, setCommitment] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState(""); // datetime-local
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && commitment.trim().length >= 8 && !busy;
  }, [title, commitment, busy]);

  async function onSubmit() {
    if (busy) return;
    setError(null);

    const t = title.trim();
    const c = commitment.trim();

    if (t.length < 3) return setError("Title must be at least 3 characters.");
    if (c.length < 8) return setError("Commitment must be at least 8 characters.");

    setBusy(true);

    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;

      if (!uid) {
        // AuthGate usually handles this, but keep safe fallback
        setError("Please sign in to create drafts.");
        return;
      }

      const deadlineISO = deadlineToISO(deadlineLocal);

      const { data, error: insErr } = await supabase
        .from("trajectories")
        .insert({
          owner_id: uid,
          title: t,
          commitment: c,
          status: "draft",
          deadline_at: deadlineISO,
          is_public: false, // draft is private
        })
        .select("id")
        .single();

      if (insErr) throw insErr;

      router.push(`/t/${data.id}`); // continue flow: lock happens there
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-2xl px-6 py-14">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Create draft</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Draft is editable. Locking happens on the next screen and is irreversible.
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

          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold">Title</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              Short and factual. No hype.
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              placeholder="e.g. Ship v1 by 2026-03-01"
            />
            {title.trim().length > 0 && title.trim().length < 3 ? (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Minimum 3 characters.</div>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold">Commitment statement</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              First person. Clear. No conditions.
            </div>
            <textarea
              value={commitment}
              onChange={(e) => setCommitment(e.target.value)}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              rows={4}
              placeholder='Example: "I will ship a public v1 by 2026-03-01 and publish the link."'
            />
            {commitment.trim().length > 0 && commitment.trim().length < 8 ? (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Minimum 8 characters.</div>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold">Deadline (optional)</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              Used for sorting + context. (Outcome rules are handled after lock.)
            </div>
            <input
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="mt-5 h-12 w-full rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {busy ? "Creating…" : "Continue →"}
          </button>

          <div className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Next: lock + stake + lock reason + share link.
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
