"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setAuthed(!!data.session);
        setReady(true);
      })
      .catch((e) => {
        setErr(String(e?.message || e));
        setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Lockpoint</h1>
          <p className="mt-2 text-sm text-white/70">
            Sign in to create and seal Locks.
          </p>

          <div className="mt-5 grid gap-3">
            <button
              onClick={() => {
                setErr(null);
                supabase.auth.signInWithOAuth({ provider: "google" }).catch((e) => {
                  setErr(String(e?.message || e));
                });
              }}
              className="h-11 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200"
            >
              Continue with Google
            </button>

            <button
              onClick={() => {
                setErr(null);
                supabase.auth.signInWithOAuth({ provider: "github" }).catch((e) => {
                  setErr(String(e?.message || e));
                });
              }}
              className="h-11 rounded-full border border-white/15 bg-white/10 text-white text-sm font-medium hover:bg-white/15"
            >
              Continue with GitHub
            </button>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
              {err}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
