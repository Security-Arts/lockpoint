import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — Lockpoint",
  description: "Lockpoint is a public registry for irreversible commitments. Lock a commitment — the record stays permanently.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "How It Works — Lockpoint",
    description: "Lock a commitment. The record stays. Public registry for irreversible commitments.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "How It Works — Lockpoint",
    description: "Lock a commitment. The record stays.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
