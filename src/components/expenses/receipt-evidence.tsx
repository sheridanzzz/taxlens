"use client";

import { useEffect, useState } from "react";
import { readEmailEvidence, receiptMime, receiptExtension, type EmailEvidence } from "@/lib/receipt-evidence";

export function ReceiptEvidence({ url, compact = false }: { url: string; compact?: boolean }) {
  const [loaded, setLoaded] = useState<{ url: string; email: EmailEvidence | null; error: boolean } | null>(null);
  const email = loaded?.url === url ? loaded.email : null;
  const error = loaded?.url === url && loaded.error;
  const mime = receiptMime(url);
  useEffect(() => {
    let active = true;
    if (mime === "message/rfc822") void readEmailEvidence(url).then(result => { if (active) setLoaded({ url, email: result, error: false }); })
      .catch(() => { if (active) setLoaded({ url, email: null, error: true }); });
    return () => { active = false; };
  }, [url, mime]);
  return <div className="min-w-0 space-y-3 text-sm">
    <a href={url} download={`original-receipt.${receiptExtension(url)}`} className="inline-block font-semibold underline">
      {mime === "message/rfc822" ? "Download original receipt email and attachments" : mime === "application/pdf" ? "Download original PDF receipt" : "Download original receipt"}
    </a>
    {mime.startsWith("image/") && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="Receipt" className={`w-full rounded-lg border object-contain ${compact ? "max-h-40" : "max-h-[60dvh]"}`} />
    )}
    {mime === "application/pdf" && <iframe src={url} title="Receipt PDF" className={`w-full rounded-lg border ${compact ? "h-48" : "h-[55dvh]"}`} />}
    {mime === "message/rfc822" && <div className={`space-y-4 overflow-y-auto rounded-lg border bg-surface p-3 ${compact ? "max-h-52" : "max-h-[55dvh]"}`}>
      {!email && <p role="status">{error ? "Preview unavailable. Download the original email to view all evidence." : "Loading receipt email…"}</p>}
      {email?.messages.map((m, i) => <div key={i} className="space-y-2">
        <h3 className="break-words font-bold">{m.subject}</h3><p className="break-all text-xs text-muted-foreground">{m.from} · {m.date}</p>
        <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">{m.text}</pre>
      </div>)}
      {email?.attachments.length ? <div className="space-y-2 border-t pt-3"><p className="font-semibold">Attachments</p>{email.attachments.map((a, i) =>
        <a key={i} href={a.dataUrl} download={a.name} className="block break-all underline">{a.name}</a>)}</div> : null}
    </div>}
  </div>;
}
