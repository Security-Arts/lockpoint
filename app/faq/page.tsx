"use client";

import Link from "next/link";
import Header from "@/components/Header";

const FAQ = [
  {
    q: "What do I get if I lock something?",
    a: "A permanent public record with a timestamp. Optionally a deadline and stake. Later, an outcome is recorded (completed or failed).",
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
    a: "No legal or financial enforcement. Pressure comes from irreversibility + public visibility.",
  },
  {
    q: "Who is this for?",
    a: "Founders, builders, creators, and teams who want public accountability and reputation based on outcomes.",
  },
];

function QA({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-black/20">
      <div className="text-sm font-semibold">{q}</div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
        {a}
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <Header userId={null} userEmail={null} onSignIn={() => {}} onSignOut={() => {}} />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
          FAQ
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Questions people ask
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          The point is simple: decisions become permanent records. Outcomes become reputation.
        </p>

        <div className="mt-8 space-y-3">
          {FAQ.map((x) => (
            <QA key={x.q} q={x.q} a={x.a} />
          ))}
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
