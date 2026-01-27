import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-zinc-800 dark:text-zinc-200">
      <h1 className="text-2xl font-semibold mb-6">Terms of Use</h1>

      <p className="mb-4 text-zinc-500">Last updated: 2026-01-01</p>

      <section className="space-y-4">
        <p>
          Lockpoint is a public registry of irreversible decisions. By using this
          service, you agree to the terms described below.
        </p>

        <h2 className="text-lg font-semibold mt-6">1. Nature of the service</h2>
        <p>
          Lockpoint is not a legal, financial, or enforcement system. It does not
          guarantee outcomes, rewards, penalties, or real-world execution of any
          decision recorded on the platform.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. Drafts vs locked records</h2>
        <p>
          Drafts are private and visible only to their owner.
        </p>
        <p>
          <strong>Once a record is locked, it becomes public by design.</strong>
          Locked records are visible to anyone and may be shared, indexed,
          cached, or stored by third parties.
        </p>
        <p>
          Dropped drafts remain private and are never published.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. User responsibility</h2>
        <p>
          You are solely responsible for the content you choose to lock. Do not
          include sensitive, confidential, or illegal information in locked
          records.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Immutability</h2>
        <p>
          Locked records cannot be edited or deleted. Amendments may be added,
          but the original record remains unchanged.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. Availability</h2>
        <p>
          The service is provided “as is” and may change, pause, or shut down at
          any time without notice.
        </p>
      </section>

      <div className="mt-10 text-xs text-zinc-500">
        <Link href="/" className="hover:underline">← Back to Home</Link>
      </div>
    </main>
  );
}
