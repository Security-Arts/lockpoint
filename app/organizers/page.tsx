"use client";

import { useState } from "react";
import Link from "next/link";

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

const MONO = { fontFamily: "var(--font-dm-mono), monospace" };
const SERIF = { fontFamily: "var(--font-fraunces), serif" };
const ACCENT = "#00C98A";

type Participant = {
  id: string;
  initials: string;
  name: string;
  status: "danger" | "warn" | "ok";
  dots: ("ok" | "no" | "mt")[];
  badge: string;
  badgeType: "danger" | "warn" | "ok";
  commitment: string;
  stake: string;
  streak: string;
  peakStreak: string;
  lastActive: string;
  sub: string;
  pattern: string;
  alert: string;
  alertType: "danger" | "warn";
  action: string;
};

const PARTICIPANTS: Participant[] = [
  {
    id: "mk", initials: "MK", name: "Maria K.", status: "danger",
    dots: ["ok","ok","ok","no","no","no","no"],
    badge: "4 days silent", badgeType: "danger",
    commitment: "Complete 3 product briefs by end of cohort",
    stake: "$50 charity pledge",
    streak: "0 days", peakStreak: "19 days",
    lastActive: "Day 19", sub: "Day 23 of 30 · Last active: Day 19",
    pattern: "Sharp drop day 19",
    alert: "Active every day until day 19 — then gone. Sharp stop, not gradual drift. In the day 20–30 window with a $50 stake and a public commitment. High rescue potential.",
    alertType: "danger",
    action: "Send personal message referencing her commitment",
  },
  {
    id: "jt", initials: "JT", name: "James T.", status: "warn",
    dots: ["ok","no","ok","no","no","ok","mt"],
    badge: "irregular", badgeType: "warn",
    commitment: "Ship one AI feature prototype",
    stake: "Public LinkedIn post",
    streak: "2 days", peakStreak: "12 days",
    lastActive: "Yesterday", sub: "Day 23 of 30 · Last active: Yesterday",
    pattern: "Skips every 2–3 days",
    alert: "Still active but inconsistent. Day 20–30 window makes this high risk. Motivation exists, structure doesn't.",
    alertType: "warn",
    action: "Light nudge — ask what's getting in the way",
  },
  {
    id: "sl", initials: "SL", name: "Sara L.", status: "warn",
    dots: ["ok","ok","ok","ok","ok","no","no"],
    badge: "slowing", badgeType: "warn",
    commitment: "Deliver PM case study",
    stake: "Accountability to cohort group",
    streak: "0 days", peakStreak: "20 days",
    lastActive: "2 days ago", sub: "Day 23 of 30 · Last active: 2 days ago",
    pattern: "Strong start, slowing",
    alert: "Strong first 20 days, last 2 missed. Early warning — if day 3 missed, escalate.",
    alertType: "warn",
    action: "Watch for tomorrow — if missed, reach out",
  },
  {
    id: "rb", initials: "RB", name: "Ravi B.", status: "danger",
    dots: ["no","no","no","no","no","no","no"],
    badge: "7 days silent", badgeType: "danger",
    commitment: "Launch one product experiment",
    stake: "$100 financial stake",
    streak: "0 days", peakStreak: "15 days",
    lastActive: "Day 16", sub: "Day 23 of 30 · Last active: Day 16",
    pattern: "7 days fully silent",
    alert: "Silent since day 16. No response to nudge on day 19. Manual contact required — this is the loss scenario Lockpoint was built to catch earlier.",
    alertType: "danger",
    action: "Direct message or call — reference the $100 stake",
  },
];

const DOT_COLORS = {
  ok: ACCENT,
  no: "#E24B4A",
  mt: "#D4D0CA",
};

export default function OrganizersPage() {
  const [selected, setSelected] = useState<string>("mk");

  const p = PARTICIPANTS.find(x => x.id === selected) ?? PARTICIPANTS[0];

  return (
    <div className="min-h-screen bg-[#F5F3EF] dark:bg-[#060B15]" style={MONO}>

      {/* NAV */}
      <nav className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-white/10 dark:bg-black/60 px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xs tracking-[0.12em] uppercase text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white">
          ← Lockpoint
        </Link>
        <div className="text-xs tracking-[0.1em] uppercase text-zinc-400 dark:text-zinc-500">Organizer dashboard</div>
        <div className="text-[10px] tracking-[0.1em] uppercase border border-zinc-200 dark:border-white/10 text-zinc-400 px-2 py-1">Demo</div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">

        {/* COHORT HEADER */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50" style={SERIF}>
              AI Product Management — Cohort 6
            </h1>
            <div className="text-xs text-zinc-400 mt-1">Day 23 of 30 · 18 participants</div>
          </div>
          <div className="flex items-center gap-2 text-xs border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 px-3 py-1.5">
            <span>⚠</span>
            <span>Day 20–30 critical window</span>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="mb-6">
          <div className="text-[10px] tracking-[0.12em] uppercase text-amber-600 dark:text-amber-400 mb-2">Critical dropout window: days 20–30</div>
          <div className="flex gap-0.5">
            {Array.from({ length: 30 }, (_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-sm"
                style={{
                  background: i < 20 ? ACCENT :
                    i === 22 ? "#F59E0B" :
                    i >= 20 ? "rgba(245,158,11,0.3)" : "#E5E7EB"
                }}
              />
            ))}
          </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active", value: "11", color: "text-zinc-900 dark:text-zinc-50" },
            { label: "Drifting", value: "4", color: "text-amber-600 dark:text-amber-400" },
            { label: "Silent 3+ days", value: "3", color: "text-red-600 dark:text-red-400" },
            { label: "Avg streak", value: "14d", color: "text-zinc-900 dark:text-zinc-50" },
          ].map(m => (
            <div key={m.label} className="border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/3 p-4">
              <div className="text-[10px] tracking-[0.1em] uppercase text-zinc-400 mb-2">{m.label}</div>
              <div className={cx("text-2xl font-light", m.color)} style={SERIF}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* LEFT: participant list */}
          <div className="border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/3">

            <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/6">
              <div className="text-[10px] tracking-[0.12em] uppercase text-zinc-400">Needs your attention</div>
            </div>

            <div className="p-3 space-y-2">
              {PARTICIPANTS.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => setSelected(pt.id)}
                  className={cx(
                    "w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-colors",
                    selected === pt.id
                      ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/8"
                      : "border-zinc-100 dark:border-white/6 hover:border-zinc-200 dark:hover:border-white/10"
                  )}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                    style={{
                      background: pt.status === "danger" ? "rgba(226,75,74,0.12)" :
                        pt.status === "warn" ? "rgba(245,158,11,0.12)" : "rgba(0,201,138,0.12)",
                      color: pt.status === "danger" ? "#E24B4A" :
                        pt.status === "warn" ? "#D97706" : ACCENT,
                    }}
                  >
                    {pt.initials}
                  </div>

                  {/* Name */}
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 flex-shrink-0 w-20">{pt.name}</div>

                  {/* Dots */}
                  <div className="flex gap-1 flex-1">
                    {pt.dots.map((d, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: DOT_COLORS[d] }}
                      />
                    ))}
                  </div>

                  {/* Badge */}
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 border flex-shrink-0"
                    style={{
                      background: pt.badgeType === "danger" ? "rgba(226,75,74,0.08)" : "rgba(245,158,11,0.08)",
                      color: pt.badgeType === "danger" ? "#E24B4A" : "#D97706",
                      borderColor: pt.badgeType === "danger" ? "rgba(226,75,74,0.2)" : "rgba(245,158,11,0.2)",
                    }}
                  >
                    {pt.badge}
                  </span>
                </button>
              ))}
            </div>

            {/* On track */}
            <div className="border-t border-zinc-100 dark:border-white/6 px-4 py-3">
              <div className="text-[10px] tracking-[0.12em] uppercase text-zinc-400 mb-2">On track</div>
              <div className="flex items-center gap-3 px-3 py-2.5 border border-zinc-100 dark:border-white/6">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                  style={{ background: "rgba(0,201,138,0.12)", color: ACCENT }}>AN</div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 w-20 flex-shrink-0">Anya N.</div>
                <div className="flex gap-1 flex-1">
                  {Array(7).fill("ok").map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                  ))}
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 border"
                  style={{ background: "rgba(0,201,138,0.08)", color: ACCENT, borderColor: "rgba(0,201,138,0.2)" }}>
                  streak 23
                </span>
              </div>
              <div className="text-xs text-zinc-400 text-center mt-2">+ 10 more on track</div>
            </div>
          </div>

          {/* RIGHT: detail */}
          <div className="border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/3">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/6">
              <div className="text-[10px] tracking-[0.12em] uppercase text-zinc-400">
                {p.name} — Detail
              </div>
            </div>

            <div className="p-4">
              <div className="text-base font-medium text-zinc-900 dark:text-zinc-50 mb-0.5" style={SERIF}>{p.name}</div>
              <div className="text-xs text-zinc-400 mb-5">{p.sub}</div>

              {/* Fields */}
              <div className="space-y-0 border border-zinc-100 dark:border-white/6 mb-4">
                {[
                  { k: "Commitment", v: p.commitment },
                  { k: "Stake", v: p.stake },
                  { k: "Current streak", v: p.streak },
                  { k: "Peak streak", v: p.peakStreak },
                  { k: "Pattern", v: p.pattern },
                ].map((row, i, arr) => (
                  <div key={row.k} className={cx("flex justify-between gap-4 px-4 py-2.5 text-xs", i < arr.length - 1 ? "border-b border-zinc-50 dark:border-white/4" : "")}>
                    <span className="text-zinc-400 flex-shrink-0">{row.k}</span>
                    <span className="text-zinc-700 dark:text-zinc-200 text-right">{row.v}</span>
                  </div>
                ))}
              </div>

              {/* Alert */}
              <div
                className="px-4 py-3 text-xs leading-relaxed mb-4 border-l-2"
                style={{
                  borderLeftColor: p.alertType === "danger" ? "#E24B4A" : "#F59E0B",
                  background: p.alertType === "danger" ? "rgba(226,75,74,0.05)" : "rgba(245,158,11,0.05)",
                  color: p.alertType === "danger" ? "#C0392B" : "#92400E",
                }}
              >
                {p.alert}
              </div>

              {/* Action button */}
              <button className="w-full px-4 py-3 text-xs text-left border transition-colors"
                style={{
                  background: "rgba(0,201,138,0.05)",
                  borderColor: "rgba(0,201,138,0.2)",
                  color: ACCENT,
                }}>
                → {p.action}
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM NOTE */}
        <div className="mt-8 border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/3 p-5">
          <div className="text-xs tracking-[0.1em] uppercase text-zinc-400 mb-3">About this dashboard</div>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-2xl">
            This is a demo of the Lockpoint organizer dashboard. In production, participant data comes from their public commitments on{" "}
            <Link href="/" className="underline hover:text-zinc-700">lockpoint.app</Link>.
            Organizers see drift patterns in real time — not after the cohort ends.
          </p>
          <div className="mt-4">
            <Link
              href="/#organizers"
              className="inline-flex items-center gap-2 h-9 px-5 text-xs tracking-[0.08em] uppercase font-medium text-white bg-zinc-900 dark:bg-white dark:text-black hover:opacity-90"
              style={{ clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))" }}
            >
              Request early access →
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
