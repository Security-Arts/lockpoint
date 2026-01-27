export const metadata = {
  title: "Terms · Lockpoint",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  const lastUpdated = "2026-01-01";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Use</h1>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Last updated: {lastUpdated}
        </p>

        <Section title="1. What Lockpoint is">
          <p>
            Lockpoint is a registry for recording decisions, commitments, and
            outcomes.
          </p>
          <p>
            It allows users to create drafts, lock decisions (irreversible), and
            append amendments and outcomes.
          </p>
          <p>
            Lockpoint does not verify truth, feasibility, or completion of any
            commitment.
          </p>
        </Section>

        <Section title="2. User responsibility">
          <p>
            You use Lockpoint voluntarily and remain fully responsible for your
            actions and results.
          </p>
          <p>
            You must ensure that anything you publish does not violate laws or
            third-party rights.
          </p>
        </Section>

        <Section title="3. Immutability">
          <p>
            Once a record is locked, it cannot be edited or deleted. The record
            can only be extended with amendments (and a final outcome where
            applicable).
          </p>
        </Section>

        <Section title="4. Public records">
          <p>
            If you mark a record as public, it may be visible to anyone and may
            be shared, cached, or indexed by third parties.
          </p>
          <p>You are responsible for content you choose to make public.</p>
        </Section>

        <Section title="5. Prohibited use">
          <p>You may not use Lockpoint to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>impersonate others;</li>
            <li>post illegal content;</li>
            <li>harass, threaten, or defame;</li>
            <li>publish third-party personal data without consent.</li>
          </ul>
        </Section>

        <Section title="6. Availability">
          <p>
            Lockpoint is provided “as is”. We may change, suspend, or discontinue
            the service at any time.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            Questions:{" "}
            <a
              className="underline underline-offset-4"
              href="mailto:a.lutsyna@gmail.com"
            >
              a.lutsyna@gmail.com
            </a>
          </p>
        </Section>
      </main>
    </div>
  );
}
