import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs"; // важливо для Resend (Node runtime)

type Payload = {
  email?: string | null;
  message?: string | null;
  page?: string | null;
};

function isEmailLike(v: string) {
  // простий чек, щоб не відсікати зайве
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const body = (await req.json()) as Payload;

    const email = (body.email ?? "").toString().trim();
    const message = (body.message ?? "").toString().trim();
    const page = (body.page ?? "").toString().trim();

    if (!message || message.length < 3) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const resend = new Resend(resendKey);

    // TODO: коли підключиш домен lockpoint.net в Resend — залишиш так.
    // Якщо домен ще не верифікований/Resend не дозволяє — заміниш `from` на дозволений sender у твоєму Resend.
    const FROM = "Lockpoint <hello@lockpoint.net>";
    const TO = "hello@lockpoint.net";

    const safeReplyTo = email && isEmailLike(email) ? email : undefined;

    await resend.emails.send({
      from: FROM,
      to: [TO],
      replyTo: safeReplyTo,
      subject: "Lockpoint feedback",
      text: [
        "Message:",
        message,
        "",
        "---",
        `Email: ${email || "anonymous"}`,
        `Page: ${page || "-"}`,
        `Time: ${new Date().toISOString()}`,
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("feedback route error:", e);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
