import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

type TrajectoryRow = {
  id: string;
  title: string | null;
  commitment: string | null;
  status: string | null;
  locked_at: string | null;
  deadline_at: string | null;
  stake_amount: number | null;
  stake_currency: string | null;
  is_public: boolean | null;
};

function fmtShort(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function buildDesc(t: TrajectoryRow) {
  const parts: string[] = [];
  if (t.commitment) parts.push(t.commitment.trim());
  const status = (t.status ?? "").toUpperCase();
  if (status) parts.push(`Status: ${status}`);
  if (t.deadline_at) parts.push(`Deadline: ${fmtShort(t.deadline_at)}`);
  if (t.stake_amount != null) {
    parts.push(`Stake: ${t.stake_amount} ${t.stake_currency || "USD"}`);
  }
  return parts.join(" · ").slice(0, 180);
}

// базовий домен для OG/канонікал
function siteUrl() {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return env || "https://lockpoint.vercel.app"; // fallback
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const { id } = params;

  const base = new URL(siteUrl());
  const pageUrl = new URL(`/t/${id}`, base);
  const ogImg = new URL(`/api/og?id=${encodeURIComponent(id)}`, base);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Safe fallback (no env)
  if (!url || !anon) {
    return {
      metadataBase: base,
      title: "Lockpoint",
      description: "Recorded decisions with irreversible outcomes.",
      robots: { index: false, follow: false },
    };
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data } = await supabase
    .from("trajectories")
    .select(
      "id,title,commitment,status,locked_at,deadline_at,stake_amount,stake_currency,is_public"
    )
    .eq("id", id)
    .maybeSingle();

  const t = data as TrajectoryRow | null;

  // If not public -> do not expose metadata
  if (!t || t.is_public !== true) {
    return {
      metadataBase: base,
      title: "Lockpoint",
      description: "Recorded decisions with irreversible outcomes.",
      robots: { index: false, follow: false },
      openGraph: {
        title: "Lockpoint",
        description: "Recorded decisions with irreversible outcomes.",
        url: pageUrl,
        type: "website",
      },
      twitter: { card: "summary" },
    };
  }

  const title = `Lockpoint — ${t.title || "Locked decision"}`;
  const description = buildDesc(t);

  return {
    metadataBase: base,
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "article",
      images: [{ url: ogImg, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImg],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
