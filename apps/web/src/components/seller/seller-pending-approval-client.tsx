"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FileText, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { getSellerProfile } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerErrorPanel,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  isSellerApproved,
  isSellerOnboardingRequiredError,
  useSellerAuth,
} from "./seller-ui";

export function SellerPendingApprovalClient() {
  const sellerAuth = useSellerAuth();
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey, "pending-approval"],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  useEffect(() => {
    if (profileQuery.data && isSellerApproved(profileQuery.data)) {
      router.replace("/seller");
    }
    if (profileQuery.error && isSellerOnboardingRequiredError(profileQuery.error)) {
      router.replace("/seller/register");
    }
  }, [profileQuery.data, profileQuery.error, router]);

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (profileQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (profileQuery.error) {
    if (isSellerOnboardingRequiredError(profileQuery.error)) {
      return <SellerSkeleton />;
    }

    return <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  const profile = profileQuery.data;
  const rejected = profile?.approvalStatus === "REJECTED" || profile?.status === "REJECTED";
  const suspended = profile?.status === "SUSPENDED";
  const pending = profile?.approvalStatus === "PENDING" || profile?.approvalStatus === "PENDING_APPROVAL";
  const headline = suspended
    ? "Seller account is suspended"
    : rejected
      ? "Seller application needs attention"
      : pending
        ? "Seller profile is under review"
        : "Seller profile is under review";
  const message = suspended
    ? "Seller operations are currently restricted. Review your profile details and contact admin support if you need clarification."
    : rejected
      ? "Your seller application was not approved. Review onboarding details, update any missing information, and resubmit or contact admin if needed."
      : pending
        ? "Your seller profile is currently under admin review. You can update your onboarding details and maintain store information while waiting for approval. Product publishing and order operations will unlock after approval."
        : "You can still review onboarding details and maintain store information while admin approval is pending.";

  if (!profile || isSellerApproved(profile)) {
    return null;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SellerPanel className="border-[#FFC7B8] bg-[#FFF8F5]">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-md bg-[#ED3500] text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-[#1F2933]">{profile.storeName}</h2>
              <SellerStatusPill status={profile.approvalStatus} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#9F2600]">
              {message}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/seller/register">{rejected ? "Update onboarding" : "Review onboarding"}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/seller/store-profile">Maintain store profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </SellerPanel>

      <SellerPanel>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">
          Current access
        </p>
        <h3 className="mt-2 text-lg font-black text-[#1F2933]">{headline}</h3>
        <div className="mt-4 grid gap-3">
          <AccessRow
            title="Profile and onboarding"
            description="You can update store identity, contact details, documents, and pickup information."
            status="Available now"
            tone="success"
            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
          />
          <AccessRow
            title="Product publishing and operational tools"
            description="Catalogue publishing, normal order fulfilment, and seller growth workflows unlock after admin approval."
            status="Unlocks after approval"
            tone="warning"
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          />
        </div>
      </SellerPanel>
    </div>
  );
}

function AccessRow({
  title,
  description,
  status,
  tone,
  icon,
}: {
  title: string;
  description: string;
  status: string;
  tone: "success" | "warning";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#F8FAFC] text-[#163B5C]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-[#1F2933]">{title}</p>
            <StatusBadge tone={tone}>{status}</StatusBadge>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{description}</p>
        </div>
      </div>
    </div>
  );
}
