"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { LockKeyhole, LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";

export function SupportChatShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const auth = useAdminAuth();
  const canAccess = auth.user?.roles.some((role) => role === "ADMIN" || role === "CHAT_SUPPORT") ?? false;

  if (!auth.isReady) {
    return <SupportState text="Loading support workspace" />;
  }
  if (!auth.isAuthenticated) {
    return <SupportLoginShell />;
  }
  if (!canAccess) {
    return <SupportState text="Chat support access is required." />;
  }

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <header className="sticky top-0 z-30 border-b border-[#D8E2EA] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-4 px-4 lg:px-6">
          <Link href="/support/chat" className="flex items-center gap-3 font-black text-[#163B5C]">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#ED3500] text-white">1HI</span>
            Support Chat
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{auth.user?.email}</p>
            <p className="text-xs font-semibold text-[#667085]">Restricted chat workspace</p>
          </div>
          <button
            type="button"
            onClick={() => void auth.logout()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D8E2EA] px-3 text-sm font-black text-[#B42318]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-5 border-b border-[#E5E7EB] pb-5">
          <div className="inline-flex items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163B5C]">
            <ShieldCheck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
            Support role workspace
          </div>
          <h1 className="mt-3 text-2xl font-black md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

function SupportLoginShell() {
  const auth = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.login(email, password);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Support sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-[#D8E2EA] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#ED3500] text-white">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-black">Support chat sign in</h1>
          <p className="mt-2 text-sm font-semibold text-[#667085]">Use a Chat Support or Admin back-office account.</p>
        </div>
        <label className="grid gap-2 text-sm font-black text-[#344054]">
          Email
          <input className="h-11 rounded-md border border-[#D8E2EA] px-3 outline-none focus:border-[#ED3500]" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-black text-[#344054]">
          Password
          <input className="h-11 rounded-md border border-[#D8E2EA] px-3 outline-none focus:border-[#ED3500]" value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {error ? <p className="mt-4 rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-semibold text-[#9B1C1C]">{error}</p> : null}
        <Button className="mt-5 w-full" type="submit" disabled={loading || !email || password.length < 8}>
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

function SupportState({ text }: { text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-6">
      <div className="rounded-lg border border-[#D8E2EA] bg-white px-5 py-4 text-sm font-black text-[#163B5C]">
        {text}
      </div>
    </main>
  );
}
