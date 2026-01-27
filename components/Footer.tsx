import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-white/10">
      <div className="mx-auto w-full max-w-3xl px-6 py-6 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="opacity-80">
            Lockpoint is not a legal or financial enforcement system.
          </span>
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">Home</Link>
          <Link href="/me" className="hover:text-zinc-900 dark:hover:text-white">My cabinet</Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
          <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">Disclaimer</Link>
        </div>
      </div>
    </footer>
  );
}
