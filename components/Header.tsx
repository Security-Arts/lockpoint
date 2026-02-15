"use client";

import Link from "next/link";

export default function Header({
  userId,
  userEmail,
  onSignIn,
  onSignOut,
}: {
  userId: string | null;
  userEmail: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight hover:opacity-80">
            Lockpoint
          </Link>
          <span className="hidden text-[11px] text-zinc-500 dark:text-zinc-400 sm:inline">
            Execution reliability layer
          </span>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/onboarding"
            className="rounded-full px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            What is Lockpoint?
          </Link>

          <Link
            href="/roadmap"
            className="hidden rounded-full px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 sm:inline"
          >
            Roadmap
          </Link>

          <Link
            href="/faq"
            className="hidden rounded-full px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 sm:inline"
          >
            FAQ
          </Link>

          <div className="ml-1 hidden h-6 w-px bg-zinc-200 dark:bg-white/10 sm:block" />

          {userId ? (
            <>
              <Link
                href="/me"
                className="rounded-full px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
                title={userEmail ?? undefined}
              >
                My cabinet
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-full px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
