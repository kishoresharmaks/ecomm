import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SellerWorkspaceRoot } from "@/components/seller/seller-ui";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default async function SellerRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-indihub-pathname") ?? "/seller";
  const isPublicSellerRoute =
    pathname === "/seller/sign-in" || pathname.startsWith("/seller/sign-in/");

  if (clerkConfigured && !isPublicSellerRoute) {
    const session = await auth();
    if (!session.userId) {
      redirect(`/seller/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
    }
  }

  if (isPublicSellerRoute) {
    return children;
  }

  return <SellerWorkspaceRoot>{children}</SellerWorkspaceRoot>;
}
