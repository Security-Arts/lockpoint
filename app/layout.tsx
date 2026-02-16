// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          "antialiased bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50",
          "min-h-screen flex flex-col",
        ].join(" ")}
      >
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
