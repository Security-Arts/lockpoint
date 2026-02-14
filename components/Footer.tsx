import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-zinc-200 dark:border-white/10">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 text-sm text-zinc-600 dark:text-zinc-400">
        
        {/* Top navigation */}
        <div className="flex flex-wrap gap-6 mb-6">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">
            Home
          </Link>
          <Link href="/me" className="hover:text-zinc-900 dark:hover:text-white">
            My cabinet
          </Link>
          <Link href="/roadmap" className="hover:text-zinc-900 dark:hover:text-white">
            Roadmap
          </Link>
          <Link href="/faq" className="hover:text-zinc-900 dark:hover:text-white">
            FAQ
          </Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">
            Privacy
          </Link>
          <Link href="/disclaimer" className="hover:text-zinc-900 dark:hover:text-white">
            Disclaimer
          </Link>
        </div>

        {/* Positioning */}
        <div className="mb-3">
          Lockpoint does not plan, remind, coach, or motivate.
          It only records commitment and outcome.
        </div>

        {/* Legal */}
        <div className="text-xs opacity-60">
          Lockpoint is not a legal or financial enforcement system.
        </div>
      </div>
    </footer>
  );
}
