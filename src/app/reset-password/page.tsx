"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LedgrLogo } from "@/components/LedgrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/env";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (!isSupabaseConfigured()) window.history.replaceState(null, "", window.location.pathname);
    // The hash is stripped on the first run, so a rerun must not clear the token it read.
    queueMicrotask(() => { if (value) setToken(value); setReady(true); });
  }, []);
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token) || isSupabaseConfigured();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8 || password.length > 256) { setError("Use a password between 8 and 256 characters."); return; }
    setBusy(true);
    try {
      if (isSupabaseConfigured()) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient(); const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error("This reset link is invalid or expired. Request a new one.");
        await supabase.auth.signOut({ scope: "global" });
      } else {
        const response = await fetch("/api/auth/password/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }), cache: "no-store" });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not update your password.");
      }
      setPassword(""); setConfirm(""); setToken(""); setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update your password. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-sm space-y-6">
    <div className="flex flex-col items-center gap-3"><LedgrLogo size="lg" /><h1 className="text-2xl font-bold">Choose a new password</h1><p className="text-center text-sm text-muted-foreground">Use at least 8 characters. You’ll sign in again after resetting.</p></div>
    {!ready ? <p role="status">Checking your reset link…</p> : done ? <div className="rounded-xl border bg-card p-6"><p role="status">Password updated. Sign in with your new password.</p></div> : !valid ? <p role="alert" className="rounded-xl border bg-card p-6 text-sm">This reset link is invalid or expired. <Link href="/forgot-password" className="underline">Request a new link</Link>.</p> : <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6">
      <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm-new-password">Confirm new password</Label><Input id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={256} value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Updating password…" : "Update password"}</Button>
    </form>}
    <p className="text-center text-sm"><Link href="/login" className="text-primary underline">Back to sign in</Link></p>
  </div></main>;
}
