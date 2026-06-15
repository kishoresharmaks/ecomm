"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export function SentryExampleClient({
  dsnConfigured,
  enabled,
}: {
  dsnConfigured: boolean;
  enabled: boolean;
}) {
  const [eventId, setEventId] = useState("");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase text-[#ED3500]">Sentry verification</p>
      <h1 className="mt-3 text-3xl font-black text-[#111827]">Test web error monitoring</h1>
      <p className="mt-3 text-sm font-medium leading-6 text-[#6B7280]">
        This route is for development verification. Production triggering is disabled unless
        `NEXT_PUBLIC_ENABLE_SENTRY_EXAMPLE=true` is set.
      </p>
      {!dsnConfigured ? (
        <p className="mt-4 rounded-2xl border border-[#F3E7E2] bg-[#FFFCFB] px-4 py-3 text-sm font-bold leading-6 text-[#6B7280]">
          Web Sentry DSN is not configured. Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`,
          then restart the Next.js dev server.
        </p>
      ) : null}
      <button
        className="mt-8 min-h-11 rounded-full bg-[#ED3500] px-6 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#F3E7E2] disabled:text-[#6B7280]"
        disabled={!enabled}
        type="button"
        onClick={() => {
          const error = new Error("Sentry example error from 1HandIndia web");
          setEventId(Sentry.captureException(error));
        }}
      >
        {dsnConfigured ? "Send test error" : "Set DSN first"}
      </button>
      {eventId ? (
        <p className="mt-4 rounded-2xl border border-[#F3E7E2] bg-[#FFFCFB] px-4 py-3 text-sm font-bold leading-6 text-[#111827]">
          Test event sent. Event ID: <span className="font-black text-[#ED3500]">{eventId}</span>
        </p>
      ) : null}
    </main>
  );
}
