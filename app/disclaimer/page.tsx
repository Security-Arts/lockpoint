export const metadata = {
  title: "Disclaimer · Lockpoint",
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

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Disclaimer</h1>

        <Section title="1. No enforcement">
          <p>
            Lockpoint is not a legal, financial, or enforcement mechanism. It does
            not guarantee that any user will act or succeed.
          </p>
        </Section>

        <Section title="2. No professional advice">
          <p>
            Nothing on Lockpoint constitutes legal, financial, medical, or
            psychological advice.
          </p>
        </Section>

        <Section title="3. Responsibility and risk">
          <p>
            You use Lockpoint at your own risk. If the system causes distress or
            pressure, stop using it.
          </p>
        </Section>

        <Section title="4. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Lockpoint and its creator are
            not liable for any loss, damages, missed goals, or reputational
            effects arising from your use of the service.
          </p>
        </Section>
      </main>
    </div>
  );
}
