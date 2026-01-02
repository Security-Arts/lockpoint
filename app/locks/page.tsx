"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

type LockRow = {
  id: string;
  title: string;
  lock_type: "personal" | "product" | "business";
  status: "draft" | "active" | "completed" | "broken";
  end_at: string;
  created_at: string;
};

export default function LocksPage() {
  const [rows, setRows] = useState<LockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("locks")
        .select("id,title,lock_type,status,end_at,created_at")
        .order("created_at", { ascending: false });

      if (!error && data) setRows(data as any);
      setLoading(false);
    })();
  }, []);

  return (
    <AuthGate>
      <div style={page}>
        <header style={header}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Your Locks</h1>
            <p style={{ opacity: 0.75, margin: "6px 0 0" }}>
              Commitment and outcome. Nothing else.
            </p>
          </div>
          <Link href="/locks/new" style={primaryLink}>
            Create Lock
          </Link>
        </header>

        {loading ? (
          <div style={{ padding: 12, opacity: 0.75 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={card}>
            <p style={{ margin: 0, opacity: 0.8 }}>
              No Locks yet. Create your first one.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <Link key={r.id} href={`/locks/${r.id}`} style={cardLink}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 650 }}>{r.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                     <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
  {r.lock_type.toUpperCase()} ·{" "}
  <span
    style={{
      fontWeight: 650,
      color:
        r.status === "completed"
          ? "#7CFF7A"
          : r.status === "broken"
          ? "#FF7A7A"
          : "inherit",
    }}
  >
    {r.status.toUpperCase()}
  </span>
</div>

                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Ends: {new Date(r.end_at).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthGate>
  );
}

const page: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "28px 16px 48px",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: 14,
};

const cardLink: React.CSSProperties = {
  ...card,
  textDecoration: "none",
  color: "inherit",
};

const primaryLink: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "white",
  textDecoration: "none",
};
