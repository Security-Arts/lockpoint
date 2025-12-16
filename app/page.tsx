"use client";

import { supabase } from "@/lib/supabase";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          MVP · Vercel + Supabase
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          Lockpoint
        </h1>

        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-300">
          <strong>Where decisions become irreversible futures.</strong>
        </p>

        <p className="mt-8 text-base text-zinc-700 dark:text-zinc-200">
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

        <div className="mt-10">
          <button
            className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            onClick={async () => {
              try {
                const { data, error } = await supabase
                  .from("trajectories")
                  .insert({
                    title: "My first lockpoint",
                  })
                  .select()
                  .single();

                if (error) {
                  console.error(error);
                  alert("Supabase error: " + error.message);
                  return;
                }

                alert("Trajectory created.\nID: " + data.id);
              } catch (e: any) {
                console.error(e);
                alert("Exception: " + (e?.message ?? String(e)));
              }
            }}
          >
            Create a Trajectory
          </button>
        </div>

        <div className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
          Lockpoint = a state change enforced by database rules. Not motivation.
        </div>
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
