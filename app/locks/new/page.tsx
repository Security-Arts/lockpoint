"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

export default function NewLockPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [criteria, setCriteria] = useState("");
  const [lockType, setLockType] = useState<"personal" | "product" | "business">(
    "personal"
  );
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);

    const { data, error } = await supabase.rpc("create_draft_lock", {
      p_title: title.trim(),
      p_commitment_statement: statement.trim(),
      p_completion_criteria: criteria.trim(),
      p_lock_type: lockType,
      p_end_at: new Date(endAt).toISOString(),
    });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    const lockId = data as string;
    router.push(`/locks/${lockId}/seal`);
  }

  return (
    <AuthGate>
      <div style={page}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Create Lock</h1>
        <p style={{ opacity: 0.75, marginTop: 0 }}>
          No motivation. No guidance. Only commitment and outcome.
        </p>

        <div style={grid}>
          <Field label="Lock type">
            <select
              value={lockType}
              onChange={(e) => setLockType(e.target.value as any)}
              style={input}
            >
              <option value="personal">Personal</option>
              <option value="product">Product</option>
              <option value="business">Business</option>
            </select>
          </Field>

          <Field label="Lock title" hint="Short, factual.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
          </Field>

          <Field
            label="Commitment statement"
            hint="One sentence. First person. No conditions."
          >
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              style={{ ...input, minHeight: 90 }}
            />
          </Field>

          <Field
            label="Completion criteria"
            hint="Binary. Measurable. Bullet points allowed."
          >
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              style={{ ...input, minHeight: 110 }}
            />
          </Field>

          <Field
            label="End date"
            hint="If you do not declare completion before this moment, the Lock becomes BROKEN automatically."
          >
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              style={input}
            />
          </Field>

          {error && (
            <div style={{ ...card, borderColor: "rgba(255,120,120,0.35)" }}>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{error}</div>
            </div>
          )}

          <button onClick={onSubmit} disabled={busy} style={btn}>
            {busy ? "Creating…" : "Continue"}
          </button>
        </div>
      </div>
    </AuthGate>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 650 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{hint}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "28px 16px 48px",
};

const grid: React.CSSProperties = { display: "grid", gap: 10 };

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.18)",
  color: "white",
  padding: "10px 10px",
  outline: "none",
  boxSizing: "border-box",
};

const btn: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
};
