"use client";

import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-24">
        {/* Title */}
        <h1 className="text-3xl font-semibold tracking-tight">
          Lockpoint records decisions that cannot be edited or deleted.
        </h1>

        {/* Body */}
        <div className="mt-8 space-y-5 text-base text-zinc-700 dark:text-zinc-200">
          <p>A decision becomes a permanent record.</p>

          <p className="font-medium">Once locked:</p>

          <ul className="list-disc space-y-2 pl-6">
            <li>it cannot be changed or deleted</li>
            <li>only outcomes can be added later</li>
            <li>failure is recorded, not hidden</li>
          </ul>

          <p>
            Lockpoint does not plan, remind, coach, or motivate.
            <br />
            It only records commitment and outcome.
          </p>
        </div>

        {/* Footer note */}
        <div className="mt-10 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          If you are not ready for irreversibility, do not lock.
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            I understand. Create my first draft →
          </Link>

          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "Lockpoint",
                  text: "Lockpoint records decisions that cannot be edited or deleted.",
                  url: window.location.origin + "/onboarding",
                });
              } else {
                navigator.clipboard.writeText(
                url: `${window.location.origin}/onboarding`,
                );
                alert("Link copied.");
              }
            }}
            className="h-12 rounded-full border border-zinc-200 bg-white px-6 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            Share
          </button>
        </div>
      </main>
    </div>
  );
}
