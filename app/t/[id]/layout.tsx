import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commitment — Lockpoint",
  description: "A permanent public commitment locked on Lockpoint. Immutable record — no edits, no deletions.",
  openGraph: {
    title: "Commitment — Lockpoint",
    description: "A permanent public commitment. Locked. Cannot be edited or deleted.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Commitment — Lockpoint",
    description: "A permanent public commitment locked on Lockpoint.",
  },
};

export default function TrajectoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
