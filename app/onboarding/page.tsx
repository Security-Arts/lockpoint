"use client";

import Link from "next/link";
import Header from "@/components/Header";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 sm:p-8">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
        {children}
      </div>
    </section>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <Header userId={null} userEmail={null} onSignIn={() => {}} onSignOut={() => {}} />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-50 to-white dark:from-white/5 dark:to-black/30" />
          <div className="relative">
            <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
              WHAT IS LOCKPOINT
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Make a decision you cannot walk back.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
              Lockpoint is a public registry where commitments become permanent records.
              <br />
              Public. Timestamped. Outcome recorded.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {["Immutable", "Public", "Timestamped", "No edits"].map((x) => (
                <span
                  key={x}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                >
                  {x}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/me"
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Create a draft →
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                View public registry →
              </Link>
            </div>

            <div className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
              Over time, consistent execution becomes a form of capital — a measurable trust signal.
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="What you get">
            <ul className="list-disc space-y-2 pl-5">
              <li>A public deadline (optional)</li>
              <li>A permanent record (cannot be edited)</li>
              <li>Visible execution history</li>
              <li>Reputation based on outcomes (not claims)</li>
            </ul>
          </Card>

          <Card title="What Lockpoint is NOT">
            <ul className="list-disc space-y-2 pl-5">
              <li>Not a coach, planner, or reminder</li>
              <li>Not legal or financial enforcement</li>
              <li>Not private notes</li>
            </ul>
          </Card>
        </div>

        {/* WHY USE */}
        <div className="mt-4">
          <Card title="Why use Lockpoint?">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-black/20">
                <div className="font-semibold">Pressure</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Public memory creates real pressure.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-black/20">
                <div className="font-semibold">Clarity</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  A decision becomes concrete, not a vibe.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-black/20">
                <div className="font-semibold">Reputation</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Outcomes build credibility over time.
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* WHO IS THIS FOR */}
        <div className="mt-4">
          <Card title="Who is this for?">
            <ul className="list-disc space-y-2 pl-5">
              <li>Founders shipping products</li>
              <li>Creators building in public</li>
              <li>People using deadlines as pressure</li>
              <li>Teams who want public accountability</li>
            </ul>
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              If you want privacy-first journaling — this is not it.
            </div>
          </Card>
        </div>

        {/* HOW IT WORKS */}
        <div className="mt-4">
          <Card title="How it works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Create a draft (editable).</li>
              <li>Lock it (irreversible).</li>
              <li>Optionally set deadline and stake.</li>
              <li>Mark outcome later: completed or failed.</li>
            </ol>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
              <span className="font-semibold">Due indicator:</span> “DUE SOON” appears if deadline is within 7 days.
              “OVERDUE” appears after the deadline date passes. It’s purely informational — the record stays.
            </div>
          </Card>
        </div>

        {/* LINKS */}
        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
          <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">Disclaimer</Link>
        </div>
      </main>
    </div>
  );
}
