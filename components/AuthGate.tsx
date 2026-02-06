"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const redirectToMe = () => `${window.location.origin}/me`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const ok = !!data.session;
      setAuthed(ok);
      setReady(true);

      if (ok && window.location.pathname === "/") {
        router.replace("/me");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const ok = !!session;
      setAuthed(ok);
      setReady(true);

      if (ok && window.location.pathname === "/") {
        router.replace("/me");
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function signIn(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectToMe(),
      },
    });
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50 grid place-items-center px-6">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-md px-6 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Lockpoint</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Sign in to create drafts, lock decisions, and add outcomes.
          </p>

          <div className="mt-6 grid gap-3">
            <button
              onClick={() => signIn("google")}
              className="h-11 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Continue with Google
            </button>

            <button
              onClick={() => signIn("github")}
              className="h-11 rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Continue with GitHub
            </button>

            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              You’ll be redirected to <span className="font-mono">/me</span> after sign-in.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
