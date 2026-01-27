import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-zinc-800 dark:text-zinc-200">
      <h1 className="text-2xl font-semibold mb-6">Privacy Policy</h1>

      <p className="mb-4 text-zinc-500">Last updated: 2026-01-01</p>

      <section className="space-y-4">
        <p>
          Lockpoint respects your privacy while operating a public registry of
          locked decisions. This policy explains what data is private and what
          becomes public.
        </p>

        <h2 className="text-lg font-semibold mt-6">1. Private data</h2>
        <p>
          Drafts are private and visible only to their owner.
        </p>
        <p>
          Authentication data (such as email or OAuth identifiers) is handled by
          third-party providers and is not publicly displayed.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. Public data</h2>
        <p>
          <strong>All locked records are public.</strong> This includes the
          record title, commitment text, timestamps, and outcomes.
        </p>
        <p>
          Public records may be viewed by anyone and may be indexed, cached, or
          archived by search engines and third-party services.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. Responsibility</h2>
        <p>
          You are responsible for any information you choose to lock. Do not
          publish personal, sensitive, or confidential data unless you accept
          the consequences of public exposure.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Data removal</h2>
        <p>
          Locked records cannot be removed from the public registry. Even if the
          service is modified or discontinued, previously public data may remain
          accessible via third parties.
        </p>
      </section>

      <div className="mt-10 text-xs text-zinc-500">
        <Link href="/" className="hover:underline">← Back to Home</Link>
      </div>
    </main>
  );
}
