"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

export default function SealLockPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const lockId = params.id;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function seal() {
    setErr(null);
    setBusy(true);

    const { error } = await supabase.rpc("seal_lock", { p_lock_id: lockId });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.push(`/locks/${lockId}`);
  }

  return (
    <AuthGate>
      <div style={page}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Seal Lock</h1>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            This decision will become permanent.
          </div>
          <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
            Once sealed, a Lock cannot be edited or deleted.
            <br />
            It will end as <b>COMPLETED</b> or <b>BROKEN</b>.
            <br />
            The record will remain in your history forever.
          </div>
        </div>

        {err && (
          <div style={{ ...card, borderColor: "rgba(255,120,120,0.35)" }}>
            {err}
          </div>
        )}

        <button onClick={seal} disabled={busy} style={btn}>
          {busy ? "Sealing…" : "Pay & Seal Lock"}
        </button>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Payment integration is next (webhook will call <code>seal_lock</code>).
        </div>
      </div>
    </AuthGate>
  );
}

const page: React.CSSProperties = {
  maxWidth: 620,
  margin: "0 auto",
  padding: "28px 16px 48px",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};
