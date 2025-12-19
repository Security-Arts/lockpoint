"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

type Lock = {
  id: string;
  title: string;
  lock_type: string;
  status: string;
  commitment_statement: string;
  completion_criteria: string;
  start_at: string;
  end_at: string;
  sealed_at: string | null;
  completed_at: string | null;
  broken_at: string | null;
};

export default function LockPage() {
  const params = useParams<{ id: string }>();
  const lockId = params.id;

  const [lock, setLock] = useState<Lock | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("locks")
        .select(
          "id,title,lock_type,status,commitment_statement,completion_criteria,start_at,end_at,sealed_at,completed_at,broken_at"
        )
        .eq("id", lockId)
        .single();

      if (!error) setLock(data as any);
    })();
  }, [lockId]);

  const timeLeft = useMemo(() => {
    if (!lock) return "";
    const ms = new Date(lock.end_at).getTime() - Date.now();
    if (ms <= 0) return "Deadline passed";
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m remaining`;
  }, [lock]);

  async function declareCompleted() {
    if (!lock) return;
    setErr(null);
    setBusy(true);
    const { error } = await supabase.rpc("declare_completed", { p_lock_id: lock.id });
    setBusy(false);
    if (error) return setErr(error.message);
    location.reload();
  }

  async function breakLock() {
    if (!lock) return;
    setErr(null);
    setBusy(true);
    const { error } = await supabase.rpc("break_lock", { p_lock_id: lock.id });
    setBusy(false);
    if (error) return setErr(error.message);
    location.reload();
  }

  return (
    <AuthGate>
      <div style={page}>
        {!lock ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : (
          <>
            <h1 style={{ fontSize: 22, marginBottom: 6 }}>{lock.title}</h1>
            <div style={{ opacity: 0.75, marginBottom: 14 }}>
              {lock.lock_type.toUpperCase()} · {lock.status.toUpperCase()} · {timeLeft}
            </div>

            <div style={card}>
              <div style={label}>Commitment</div>
              <div style={mono}>{lock.commitment_statement}</div>
            </div>

            <div style={card}>
              <div style={label}>Completion criteria</div>
              <pre style={pre}>{lock.completion_criteria}</pre>
            </div>

            {err && (
              <div style={{ ...card, borderColor: "rgba(255,120,120,0.35)" }}>
                {err}
              </div>
            )}

            {lock.status === "active" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <button onClick={declareCompleted} disabled={busy} style={btn}>
                  Declare Completed
                </button>
                <button onClick={breakLock} disabled={busy} style={btnDanger}>
                  Break Lock
                </button>
              </div>
            ) : (
              <div style={card}>
                <div style={{ fontWeight: 650 }}>Final status</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                  {lock.status === "completed" && (
                    <>Completed at {new Date(lock.completed_at!).toLocaleString()}</>
                  )}
                  {lock.status === "broken" && (
                    <>Broken at {new Date(lock.broken_at!).toLocaleString()}</>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthGate>
  );
}

const page: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "28px 16px 48px",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
};

const label: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginBottom: 8 };
const mono: React.CSSProperties = { lineHeight: 1.45 };
const pre: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  opacity: 0.92,
};

const btn: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(255,90,90,0.25)",
  background: "rgba(255,90,90,0.10)",
};
