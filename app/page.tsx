"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Trajectory = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [items, setItems] = useState<Trajectory[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [lockOpen, setLockOpen] = useState(false);
const [lockId, setLockId] = useState<string | null>(null);
const [ack, setAck] = useState(false);
const [reason, setReason] = useState("");

async function lockTrajectory(id: string) {
  setToast(null);
  const { error } = await supabase
    .from("trajectories")
    .update({
      status: "locked",
      locked_at: new Date().toISOString(),
      lock_reason: reason || null,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    setToast("Lock error: " + error.message);
    return;
  }

  setToast("LOCKED: irreversible");
  setLockOpen(false);
  setAck(false);
  setReason("");
  await loadLatest();
}

  async function loadLatest() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("trajectories")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error(error);
      setToast("Error loading list: " + error.message);
      setLoadingList(false);
      return;
    }

    setItems((data ?? []) as Trajectory[]);
    setLoadingList(false);
  }

  useEffect(() => {
    loadLatest();
  }, []);

  async function createTrajectory() {
    setBusy(true);
    setToast(null);

    const { data, error } = await supabase
      .from("trajectories")
      .insert({ title: "My first lockpoint" })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setToast("Error: " + error.message);
      setBusy(false);
      return;
    }

    setToast(`Trajectory created: ${data.id}`);
    await loadLatest();
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          MVP · Vercel + Supabase
        </div>

        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight">
          Lockpoint
        </h1>

        <p className="mt-3 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          <strong>Where decisions become irreversible futures.</strong>
        </p>

        <p className="mt-8 text-base leading-7 text-zinc-700 dark:text-zinc-200">
          This is not planning. This is a point of no return.
        </p>

        <div className="mt-10 grid gap-3">
          <Feature
            title="Decisions → Reality"
            text="A decision becomes a recorded, constrained future."
          />
          <Feature
            title="No Rollback"
            text="After Lockpoint: edits are blocked. Only amendments."
          />
          <Feature
            title="Guided Trajectory"
            text="You commit to the next action, constraints, and checkpoints."
          />
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={busy}
            onClick={createTrajectory}
            className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {busy ? "Creating..." : "Create a Trajectory"}
          </button>
        <button
  type="button"
  className="mt-2 inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
  onClick={() => {
    setLockId(t.id);
    setLockOpen(true);
    setAck(false);
    setReason("");
  }}
>
  LOCK
</button>

          {toast && (
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              {toast}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-sm font-semibold">Latest trajectories</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Read-only history. This is what “it exists” looks like.
          </div>

          <div className="mt-4 space-y-2">
            {loadingList ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                No trajectories yet.
              </div>
            ) : (
              items.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-black/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono">{t.id}</span> ·{" "}
                    <span className="uppercase tracking-wide">{t.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
          Lockpoint = a state change, enforced by database rules. Not motivation.
        </div>
        {lockOpen && lockId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-black">
      <div className="text-lg font-semibold">Lock this trajectory?</div>
      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        After LOCK, this record becomes <strong>irreversible</strong>.
        You will not be able to edit or delete it. Only amendments can be added.
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

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-1"
        />
        <span className="text-zinc-700 dark:text-zinc-200">
          I understand: after LOCK, this cannot be edited or deleted.
        </span>
      </label>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          className="h-11 flex-1 rounded-full border border-zinc-200 bg-white text-sm font-medium transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          onClick={() => setLockOpen(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!ack}
          className="h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          onClick={() => lockTrajectory(lockId)}
        >
          LOCK (irreversible)
        </button>
      </div>

      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Lockpoint does not guarantee outcomes. It guarantees an immutable record.
      </div>
    </div>
  </div>
)}

      </main>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {text}
      </div>
    </div>
  );
}
