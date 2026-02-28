import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lockpoint — Public Commitment Registry",
  description: "Lock a commitment. The record stays. Public registry for irreversible commitments with permanent outcomes.",
};

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
