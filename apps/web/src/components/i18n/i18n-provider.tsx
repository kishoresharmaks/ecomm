"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { ReactNode, useEffect, useState } from "react";
import { useMarket } from "../market/market-context";

// Fallback messages (English) to show before the actual language loads
import defaultMessages from "@/messages/en.json";

const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  IN: "Asia/Kolkata",
  AE: "Asia/Dubai",
  US: "America/New_York",
  GB: "Europe/London",
  SG: "Asia/Singapore",
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const { language, countryCode } = useMarket();
  const [messages, setMessages] = useState<AbstractIntlMessages>(defaultMessages);
  const timeZone = TIMEZONE_BY_COUNTRY[countryCode] ?? "Asia/Kolkata";

  useEffect(() => {
    // Dynamically load the language file based on user preference
    import(`@/messages/${language}.json`)
      .then((mod) => {
        setMessages(mod.default);
      })
      .catch((err) => {
        console.error(`Failed to load translations for ${language}`, err);
        setMessages(defaultMessages);
      });
  }, [language]);

  return (
    <NextIntlClientProvider locale={language} messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
