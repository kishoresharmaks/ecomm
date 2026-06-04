import { z } from "zod";

export const brandConfig = {
  name: "1HandIndia",
  shortName: "1HI",
  tagline: "Trusted marketplace for customers, sellers, hyperlocal stores, and B2B buyers.",
  colors: {
    primary: "#ED3500",
    primaryHover: "#C72D00",
    primarySoft: "#FFF0EC",
    primaryBorder: "#FFC7B8",
    secondary: "#FFFCFB",
    navy: "#163B5C",
    orange: "#ED3500",
    green: "#0F8A5F",
    gold: "#D9A441",
    ivory: "#FFFCFB",
    ink: "#1F2933",
    grey: "#E5E7EB",
    red: "#D64545",
  },
} as const;

export const phaseOneScope = {
  budgetInr: 200000,
  currency: "INR",
  activeSurfaces: ["storefront", "customer", "seller", "b2b", "admin"] as const,
  futureUpgrades: [
    "native-mobile-apps",
    "live-courier-api",
    "automated-payouts",
    "sms-whatsapp-automation",
    "advanced-b2b-rfq-po",
    "realtime-chat",
    "advanced-product-analytics",
  ] as const,
} as const;

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_DIRECT_URL: z.string().optional(),
  DATABASE_READ_URL: z.string().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_CORS_ORIGINS: z.string().default("http://localhost:3000"),
  REDIS_URL: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["smtp", "brevo", "resend", "sendgrid"]).default("smtp"),
  EMAIL_FROM_NAME: z.string().default("1HandIndia"),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_ADMIN_RECIPIENTS: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SMTP_BRIDGE_URL: z.string().url().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  FX_PROVIDER: z.enum(["frankfurter"]).default("frankfurter"),
  FX_BASE_CURRENCY: z.string().length(3).default("INR"),
  FX_CACHE_TTL_MINUTES: z.coerce.number().int().positive().default(360),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export const publicWebEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("1HandIndia"),
  NEXT_PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicWebEnv = z.infer<typeof publicWebEnvSchema>;

export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(env);
}

export function parsePublicWebEnv(env: Record<string, string | undefined>): PublicWebEnv {
  return publicWebEnvSchema.parse(env);
}
