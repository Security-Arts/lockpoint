"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderProps = {
  userId: string | null;
  userEmail: string | null;
  onSignIn: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  onGoRegistry?: () => void; // optional (works on home only)
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-2 text-xs font-semibold transition",
        "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        "dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white",
        active && "bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-white"
      )}
    >
      {label}
    </Link>
  );
}

export default function Header({ userId, userEmail, onSignIn, onSignOut, onGoRegistry }: HeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const active = useMemo(() => {
    const p = pathname || "/";
    return {
      home: p === "/",
      me: p.startsWith("/me"),
      onboarding: p.startsWith("/onboarding"),
      roadmap: p.startsWith("/roadmap"),
      faq: p.startsWith("/faq"),
      terms: p.startsWith("/terms"),
      privacy: p.startsWith("/privacy"),
      disclaimer: p.startsWith("/disclaimer"),
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight hover:opacity-80">
            Lockpoint
          </Link>
          <span className="hidden text-[11px] text-zinc-500 dark:text-zinc-400 sm:inline">
            Public decisions. Permanent record.
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink href="/" label="Home" active={active.home} />
          {onGoRegistry ? (
            <button
              type="button"
              onClick={onGoRegistry}
              className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              Registry
            </button>
          ) : (
            <NavLink href="/#registry" label="Registry" />
          )}

          <NavLink href="/onboarding" label="What is Lockpoint?" active={active.onboarding} />
          <NavLink href="/roadmap" label="Roadmap" active={active.roadmap} />
          <NavLink href="/faq" label="FAQ" active={active.faq} />

          <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-white/10" />

          {userId ? (
            <>
              <NavLink href="/me" label="My cabinet" active={active.me} />
              <button
                type="button"
                onClick={() => onSignOut()}
                className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
                title={userEmail ?? undefined}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSignIn()}
              className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Sign in
            </button>
          )}
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 sm:hidden">
          {userId ? (
            <Link
              href="/me"
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            >
              Cabinet
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onSignIn()}
              className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
            >
              Sign in
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            aria-label="Menu"
            aria-expanded={open}
          >
            <span className="text-lg leading-none">{open ? "×" : "≡"}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-black sm:hidden">
          <div className="flex flex-col gap-2">
            <Link href="/" onClick={() => setOpen(false)} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Home
            </Link>

            {onGoRegistry ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onGoRegistry();
                }}
                className="text-left text-sm font-semibold text-zinc-800 dark:text-zinc-100"
              >
                Registry
              </button>
            ) : (
              <Link href="/#registry" onClick={() => setOpen(false)} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Registry
              </Link>
            )}

            <Link href="/onboarding" onClick={() => setOpen(false)} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              What is Lockpoint?
            </Link>
            <Link href="/roadmap" onClick={() => setOpen(false)} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Roadmap
            </Link>
            <Link href="/faq" onClick={() => setOpen(false)} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              FAQ
            </Link>

            <div className="my-1 h-px bg-zinc-200 dark:bg-white/10" />

            <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
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

            {userId && (
              <button
                type="button"
                onClick={() => onSignOut()}
                className="mt-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
