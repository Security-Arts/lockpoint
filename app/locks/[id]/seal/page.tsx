"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AuthGate } from "@/components/AuthGate";

type Trajectory = {
  id: string;
  owner_id: string | null;
  title: string | null;
  commitment: string | null;
  status: string | null;
  locked_at?: string | null;
  is_public?: boolean | null;
};

function isDraft(status?: string | null) {
  return (status ?? "").toLowerCase() === "draft";
}

export default function SealLockPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<string | null>(null);
  const [t, setT] = useState<Trajectory | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ownerOk = useMemo(() => !!me && !!t?.owner_id && t.owner_id === me, [me, t?.owner_id]);
  const canLock = useMemo(() => {
    if (!t) return false;
    if (!ownerOk) return false;
    if (!isDraft(t.status)) return false;
    const titleOk = (t.title ?? "").trim().length >= 3;
    const commOk = (t.commitment ?? "").trim().length >= 8;
    return titleOk && commOk;
  }, [t, ownerOk]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!id) return "";
    return `${window.location.origin}/t/${id}`;
  }, [id]);

  async function load() {
    if (!id) return;
    setErr(null);

    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMe(uid);

      const { data, error } = await supabase
        .from("trajectories")
        .select("id,owner_id,title,commitment,status,locked_at,is_public")
        .eq("id", id)
        .single();

      if (error) throw error;
      setT(data as Trajectory);

      if (!uid) {
        setErr("Please sign in to continue.");
        return;
      }
      if ((data as any)?.owner_id !== uid) {
        setErr("Owner only.");
        return;
      }
      if (!isDraft((data as any)?.status)) {
        setErr("Only drafts can be locked.");
        return;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Load failed");
      setT(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function lockNow() {
    if (!id) return;
    setErr(null);

    if (!canLock) {
      setErr('Cannot lock. Make sure title ≥ 3 chars and commitment ≥ 8 chars, and you are the owner.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        status: "locked",
        locked_at: new Date().toISOString(),
        is_public: true, // ✅ LOCK => public (your концепт)
      };

      // atomic: lock only if still draft
      const { data: updated, error } = await supabase
        .from("trajectories")
        .update(payload)
        .eq("id", id)
        .eq("status", "draft")
        .select("id,status")
        .maybeSingle();

      if (error) throw error;
      if (!updated) throw new Error("This record is not a draft anymore.");

      // copy share link (best-effort)
      if (shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch {}
      }

      router.push(`/t/${id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Lock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-2xl px-6 py-14">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Lock</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                This makes the decision irreversible and public.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Home
              </Link>
              <Link
                href="/me"
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                My cabinet
              </Link>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold">This decision will become permanent.</div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
              Once locked:
              <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                <li>it cannot be edited or deleted</li>
                <li>only amendments/outcomes can be added later</li>
                <li>the record becomes public and shareable</li>
              </ul>
            </div>

            {t ? (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-black/20">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Preview</div>
                <div className="mt-1 font-medium break-words">{t.title ?? "—"}</div>
                {t.commitment ? (
                  <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{t.commitment}</div>
                ) : null}
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  status: {(t.status ?? "—").toUpperCase()}
                </div>
              </div>
            ) : null}

            {err ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {err}
              </div>
            ) : null}

            <button
              onClick={lockNow}
              disabled={busy || !canLock}
              className="mt-4 h-11 w-full rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {busy ? "Locking…" : "LOCK — irreversible"}
            </button>

            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              No payment in beta. (This page is a legacy alias for /t/[id].)
            </div>
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
