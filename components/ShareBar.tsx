"use client";

import { useMemo, useState } from "react";

export default function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(() => {
    return title
      ? `Just locked a public commitment on Lockpoint: "${title}" — permanent record, no edits. ${url} #buildinpublic`
      : `Just locked a public commitment on Lockpoint — permanent record, no edits. ${url} #buildinpublic`;
  }, [title, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  async function nativeShare() {
    if (!("share" in navigator)) return false;
    try {
      await (navigator as any).share({ title: "Lockpoint", text: shareText, url });
      return true;
    } catch {
      return false;
    }
  }

  const xHref = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        {copied ? "Copied" : "Copy link"}
      </button>

      <button
        type="button"
        onClick={async () => { const ok = await nativeShare(); if (!ok) window.open(liHref, "_blank", "noopener,noreferrer"); }}
        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        Share
      </button>

      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        Post on X
      </a>

      <a
        href={liHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        LinkedIn
      </a>
    </div>
  );
}
