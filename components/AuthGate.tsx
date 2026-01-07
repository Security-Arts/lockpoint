"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const ok = !!data.session;
      setAuthed(ok);
      setReady(true);

      // ✅ після логіну з головної → /me
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

  if (!ready) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!authed) {
    return (
      <div style={{ maxWidth: 420, margin: "60px auto", padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Lockpoint</h1>
        <p style={{ opacity: 0.8, marginTop: 8 }}>
          Sign in to create and seal Locks.
        </p>

        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <button
            onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}
            style={btn}
          >
            Continue with Google
          </button>
          <button
            onClick={() => supabase.auth.signInWithOAuth({ provider: "github" })}
            style={btn}
          >
            Continue with GitHub
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
};
