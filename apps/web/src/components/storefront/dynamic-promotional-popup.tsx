"use client";

import dynamic from "next/dynamic";

export const DynamicPromotionalPopup = dynamic(
  () => import("./promotional-popup").then((m) => m.PromotionalPopup),
  { ssr: false }
);
