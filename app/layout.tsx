import type { Metadata } from "next";
import { DM_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Lockpoint — Public Commitment Registry",
  description:
    "Lock a commitment. The record stays. Public registry for irreversible commitments with permanent outcomes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={[
          dmMono.variable,
          fraunces.variable,
          "antialiased bg-zinc-50 text-zinc-900 dark:bg-[#060B15] dark:text-zinc-50",
          "min-h-screen flex flex-col",
        ].join(" ")}
      >
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
