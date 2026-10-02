"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LedgrLogo } from "@/components/LedgrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/env";

const sentMessage = "If an account matches that email, we’ll send a password reset link. Check your inbox and spam folder.";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      if (isSupabaseConfigured()) {
        const { createClient } = await import("@/lib/supabase/client");
        const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
        if (error) throw new Error("Password recovery is temporarily unavailable. Please try again.");
      } else {
        const response = await fetch("/api/auth/password/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), cache: "no-store" });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not request a reset. Please try again.");
      }
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not request a reset. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3"><LedgrLogo size="lg" /><h1 className="text-2xl font-bold">Forgot your password?</h1><p className="text-center text-sm text-muted-foreground">Enter the email you use for Ledgr. We’ll send a link to choose a new password.</p></div>
      {sent ? <div className="space-y-4 rounded-xl border bg-card p-6"><p role="status" className="text-sm">{sentMessage}</p><Button variant="outline" className="w-full" onClick={() => setSent(false)}>Try another email</Button></div> : <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6">
        <div className="space-y-1.5"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Requesting link…" : "Send reset link"}</Button>
      </form>}
      <p className="text-center text-sm"><Link href="/login" className="text-primary underline">Back to sign in</Link></p>
    </div>
  </main>;
}
