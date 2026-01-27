export const metadata = {
  title: "Privacy · Lockpoint",
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

export default function PrivacyPage() {
  const lastUpdated = "2026-01-01";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Last updated: {lastUpdated}
        </p>

        <Section title="1. Data we collect">
          <p>Lockpoint may process:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>authentication data (OAuth provider user id / email);</li>
            <li>records you create (drafts, locked records, amendments);</li>
            <li>basic technical logs (timestamps, IP/user-agent where applicable).</li>
          </ul>
        </Section>

        <Section title="2. Public vs private">
          <p>Drafts are private to the owner.</p>
          <p>
            Locked records are public only when explicitly marked as public.
          </p>
          <p>
            Dropped records are treated as private.
          </p>
        </Section>

        <Section title="3. No selling of data">
          <p>We do not sell user data.</p>
          <p>We do not run ads.</p>
        </Section>

        <Section title="4. Storage and security">
          <p>
            Data is stored using third-party infrastructure (e.g., Supabase).
            No system is perfectly secure.
          </p>
        </Section>

        <Section title="5. Deletion and retention">
          <p>
            Drafts can be dropped. Locked records are designed to be immutable
            and may not be deletable.
          </p>
        </Section>

        <Section title="6. Contact">
          <p>
            Privacy questions:{" "}
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
