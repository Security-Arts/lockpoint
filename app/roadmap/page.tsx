"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/lib/useAuth";

const PHASES = [
  {
    name: "Phase 1 — Registry (now)",
    items: [
      "Public registry of locked commitments",
      "Draft → Lock → Outcome",
      "Deadlines + due indicators",
      "Filtering by status, deadline, stake",
      "Public record pages with amendment log",
      "Self-declared stakes (on record, not enforced)",
    ],
  },
  {
    name: "Phase 2 — Profiles",
    items: [
      "Public profile pages",
      "Execution history grouped by user",
      "Credibility signals based on completion rate",
      "Verified identity (domain, GitHub, LinkedIn)",
      "Embeddable profile widget",
    ],
  },
  {
    name: "Phase 3 — Groups & B2B",
    items: [
      "Group workspaces for cohorts and masterminds",
      "Organizer dashboard with completion rates",
      "Amendment history visible to group",
      "Verified identity badges",
      "API access for integration",
    ],
    note: "For cohort organizers, accelerators, and mastermind groups who want visible accountability from their participants.",
  },
];

export default function RoadmapPage() {
  const { userId, userEmail, signIn, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <Header userId={userId} userEmail={userEmail} onSignIn={signIn} onSignOut={signOut} />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">ROADMAP</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Where Lockpoint is going</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          Lockpoint is a permanent public registry. Here is where it is going.
        </p>

        <div className="mt-4 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">← Home</Link>
          <Link href="/me" className="hover:text-zinc-900 dark:hover:text-white">My commitments →</Link>
        </div>

        <div className="mt-8 space-y-4">
          {PHASES.map((p) => (
            <section key={p.name} className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 sm:p-8">
              <div className="text-sm font-semibold">{p.name}</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                {p.items.map((x) => <li key={x}>{x}</li>)}
              </ul>
              {p.note && (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                  {p.note}
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">Home</Link>
          <Link href="/faq" className="hover:text-zinc-900 dark:hover:text-white">FAQ</Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
          <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">Disclaimer</Link>
        </div>
      </main>
    </div>
  );
}
