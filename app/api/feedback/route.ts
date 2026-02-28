import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

type Payload = {
  email?: string | null;
  message?: string | null;
  page?: string | null;
  category?: string | null;
  rating?: number | null;
};

function isEmailLike(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const FROM = process.env.FEEDBACK_FROM; // e.g. "Lockpoint <hello@lockpoint.app>" OR "hello@lockpoint.app"
    const TO = process.env.FEEDBACK_TO;     // e.g. "a.lutsyna@gmail.com"

    if (!resendKey) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }
    if (!FROM) {
      return NextResponse.json({ ok: false, error: "Missing FEEDBACK_FROM" }, { status: 500 });
    }
    if (!TO) {
      return NextResponse.json({ ok: false, error: "Missing FEEDBACK_TO" }, { status: 500 });
    }

    const body = (await req.json()) as Payload;

    const email = (body.email ?? "").toString().trim();
    const messageRaw = (body.message ?? "").toString();
    const message = messageRaw.trim();
    const page = (body.page ?? "").toString().trim();
    const category = (body.category ?? "").toString().trim();
    const rating = typeof body.rating === "number" ? body.rating : null;

    if (!message || message.length < 3) {
      return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ ok: false, error: "Message too long" }, { status: 413 });
    }

    const resend = new Resend(resendKey);

    const safeReplyTo = email && isEmailLike(email) ? email : undefined;

    const origin = req.headers.get("origin") || "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    await resend.emails.send({
      from: FROM,                 // must be from your verified domain (lockpoint.app)
      to: [TO],                   // your Gmail (or any inbox)
      reply_to: safeReplyTo,      // optional
      subject: `Lockpoint feedback${page ? ` — ${page}` : ""}`,
      text: [
        "Message:",
        message,
        "",
        "---",
        `Email: ${email || "anonymous"}`,
        `Category: ${category || "-"}`,
        `Rating: ${rating ?? "-"}`,
        `Page: ${page || "-"}`,
        `Origin: ${origin || "-"}`,
        `IP: ${ip || "-"}`,
        `Time: ${new Date().toISOString()}`,
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("feedback route error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Send failed" }, { status: 500 });
  }
}
