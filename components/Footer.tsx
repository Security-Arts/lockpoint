import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-zinc-500 dark:text-zinc-400 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="leading-relaxed">
            Lockpoint does not plan, remind, coach, or motivate. It only records commitment and outcome.
            <div className="mt-1 opacity-80">Not a legal or financial enforcement system.</div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
            <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">Disclaimer</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
