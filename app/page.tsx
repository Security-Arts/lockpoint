"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [status, setStatus] = useState("idle");

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          MVP · Vercel + Supabase
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Lockpoint</h1>

        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-300">
          <strong>Where decisions become irreversible futures.</strong>
        </p>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          Status: <span className="font-mono">{status}</span>
        </div>

        <div className="mt-10">
          <button
            type="button"
            className="h-12 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            onClick={async () => {
              console.log("CLICKED");
              setStatus("clicked → sending…");

              try {
                const { data, error } = await supabase
                  .from("trajectories")
                  .insert({ title: "My first lockpoint" })
                  .select()
                  .single();

                if (error) {
                  console.error("SUPABASE ERROR:", error);
                  setStatus("error: " + error.message);
                  return;
                }

                setStatus("created: " + data.id);
              } catch (e: any) {
                console.error("EXCEPTION:", e);
                setStatus("exception: " + (e?.message ?? String(e)));
              }
            }}
          >
            Create a Trajectory
          </button>
        </div>
      </main>
    </div>
  );
}
