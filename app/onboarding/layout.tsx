import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding — Lockpoint",
  description:
    "Lockpoint records decisions that cannot be edited or deleted. A decision becomes a permanent record.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Onboarding — Lockpoint",
    description:
      "Lockpoint records decisions that cannot be edited or deleted.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Onboarding — Lockpoint",
    description:
      "Lockpoint records decisions that cannot be edited or deleted.",
  },
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
