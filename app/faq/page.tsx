"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/lib/useAuth";

const FAQ = [
  {
    q: "What do I get if I lock something?",
    a: "A permanent public record with a timestamp. Optionally a deadline and stake. Later, an outcome is recorded — completed or dropped.",
  },
  {
    q: "Can I edit or delete a locked commitment?",
    a: "No. Drafts are editable. Locked records are immutable.",
  },
  {
    q: "What does DUE SOON / OVERDUE mean?",
    a: "DUE SOON appears when the deadline is within 7 days. OVERDUE appears after the deadline date passes. It does not enforce anything — it simply shows status.",
  },
  {
    q: "Is this a productivity app?",
    a: "No. Lockpoint does not coach, plan, or remind. It records commitment and outcome.",
  },
  {
    q: "Is there any enforcement?",
    a: "No legal or financial enforcement. Pressure comes from irreversibility and public visibility.",
  },
  {
    q: "Who is this for?",
    a: "Founders, builders, and teams who want their execution record to mean something. Cohort organizers who want visible follow-through from their participants.",
  },
  {
    q: "I locked something by accident. What can I do?",
    a: "Nothing. The lock is permanent by design. If you committed to something you no longer intend to keep, drop it — add an amendment declaring why. The record of honest dropping is as credible as the record of completing.",
  },
  {
    q: "What happens when my deadline passes?",
    a: "The record is marked OVERDUE. Nothing automatic happens — Lockpoint does not enforce deadlines. You decide whether to mark it completed or dropped. The overdue indicator is informational only.",
  },
  {
    q: "Can I use Lockpoint for my team or cohort?",
    a: "Yes. Each member creates their own account and locks their own commitments. You can share individual record links with the group. Group workspaces are on the roadmap.",
  },
  {
    q: "What is a stake?",
    a: "A self-declared number you put on record with your commitment. Lockpoint does not collect, hold, or enforce stakes. It is a public signal only — a number that stays on the record permanently.",
  },
];

function QA({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-black/20">
      <div className="text-sm font-semibold">{q}</div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{a}</div>
    </div>
  );
}

export default function FAQPage() {
  const { userId, userEmail, signIn, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <Header userId={userId} userEmail={userEmail} onSignIn={signIn} onSignOut={signOut} />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">FAQ</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Questions people ask</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          The point is simple: commitments become permanent records. Outcomes become reputation.
        </p>

        <div className="mt-4 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">← Home</Link>
          <Link href="/me" className="hover:text-zinc-900 dark:hover:text-white">My commitments →</Link>
        </div>

        <div className="mt-8 space-y-3">
          {FAQ.map((x) => <QA key={x.q} q={x.q} a={x.a} />)}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">Home</Link>
          <Link href="/onboarding" className="hover:text-zinc-900 dark:hover:text-white">What is Lockpoint</Link>
          <Link href="/roadmap" className="hover:text-zinc-900 dark:hover:text-white">Roadmap</Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
          <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">Disclaimer</Link>
        </div>
      </main>
    </div>
  );
}
