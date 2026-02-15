"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  userId: string | null;
  userEmail: string | null;

  onSignIn: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;

  onGoRegistry?: () => void; // optional: only for pages that have registry section
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export default function Header({ userId, userEmail, onSignIn, onSignOut, onGoRegistry }: Props) {
  const [open, setOpen] = useState(false);

  // close menu on route change-ish (basic)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cx("flex items-center", mobile ? "flex-col items-stretch gap-2" : "gap-2")}>
      {/* Registry only if callback exists */}
      {onGoRegistry ? (
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onGoRegistry();
          }}
          className={cx(
            "rounded-full px-3 py-2 text-xs font-semibold",
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
            mobile && "text-left"
          )}
        >
          Registry
        </button>
      ) : (
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className={cx(
            "rounded-full px-3 py-2 text-xs font-semibold",
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
            mobile && "text-left"
          )}
        >
          Home
        </Link>
      )}

      <Link
        href="/onboarding"
        onClick={() => setOpen(false)}
        className={cx(
          "rounded-full px-3 py-2 text-xs font-semibold",
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
          "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
          mobile && "text-left"
        )}
      >
        What is Lockpoint?
      </Link>

      <Link
        href="/roadmap"
        onClick={() => setOpen(false)}
        className={cx(
          "rounded-full px-3 py-2 text-xs font-semibold",
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
          "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
          mobile && "text-left"
        )}
      >
        Roadmap
      </Link>

      <Link
        href="/faq"
        onClick={() => setOpen(false)}
        className={cx(
          "rounded-full px-3 py-2 text-xs font-semibold",
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
          "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
          mobile && "text-left"
        )}
      >
        FAQ
      </Link>

      <div className={cx("bg-zinc-200 dark:bg-white/10", mobile ? "my-2 h-px w-full" : "mx-1 h-6 w-px")} />

      {userId ? (
        <>
          <Link
            href="/me"
            onClick={() => setOpen(false)}
            title={userEmail ?? undefined}
            className={cx(
              "rounded-full px-3 py-2 text-xs font-semibold",
              "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
              mobile && "text-left"
            )}
          >
            My cabinet
          </Link>

          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await onSignOut();
            }}
            className={cx(
              "rounded-full px-3 py-2 text-xs font-semibold",
              "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
              mobile && "text-left"
            )}
          >
            Sign out
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={async () => {
            setOpen(false);
            await onSignIn();
          }}
          className={cx(
            "rounded-full px-3 py-2 text-xs font-semibold",
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
            mobile && "text-left"
          )}
        >
          Sign in
        </button>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight hover:opacity-80">
            Lockpoint
          </Link>

          <span className="hidden text-[11px] text-zinc-500 dark:text-zinc-400 sm:inline">
            Public. Permanent. Outcome recorded.
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:block">
          <NavLinks />
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 sm:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          {/* simple icon */}
          <span className="block h-4 w-5">
            <span className={cx("block h-[2px] w-5 bg-current transition", open && "translate-y-[7px] rotate-45")} />
            <span className={cx("mt-[5px] block h-[2px] w-5 bg-current transition", open && "opacity-0")} />
            <span className={cx("mt-[5px] block h-[2px] w-5 bg-current transition", open && "-translate-y-[7px] -rotate-45")} />
          </span>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/70 sm:hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-3">
            <NavLinks mobile />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <Link href="/terms" onClick={() => setOpen(false)} className="hover:text-zinc-900 dark:hover:text-white">
                Terms
              </Link>
              <Link href="/privacy" onClick={() => setOpen(false)} className="hover:text-zinc-900 dark:hover:text-white">
                Privacy
              </Link>
              <Link href="/disclaimer" onClick={() => setOpen(false)} className="hover:text-zinc-900 dark:hover:text-white">
                Disclaimer
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
