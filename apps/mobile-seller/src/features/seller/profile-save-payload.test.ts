import { describe, expect, it } from "vitest";
import {
  buildSellerProfilePatchPayload,
  hasSellerProfileUnsavedChanges,
  sellerProfileToFormFields,
} from "./profile-save-payload";
import type { SellerProfile } from "./seller-api";

const savedProfile: SellerProfile = {
  id: "seller_1",
  storeName: "Saved Store",
  status: "APPROVED",
  approvalStatus: "APPROVED",
  profile: {
    logoUrl: "1handindia/sellers/user_1/profile/logo/logo.jpg",
    bannerUrl: "1handindia/sellers/user_1/profile/banner/banner.jpg",
    description: "Existing description",
    contactName: "Seller Owner",
    contactPhone: "9876543210",
    contactEmail: "seller@example.com",
    businessLegalName: "Saved Store LLP",
    businessType: "LLP",
    gstNumber: "33ABCDE1234F1Z5",
    panNumber: "ABCDE1234F",
  },
  payoutProfile: {
    accountHolderName: "Seller Owner",
    bankName: "HDFC Bank",
    ifscCode: "HDFC0001234",
    maskedAccountNumber: "****6789",
    maskedUpiId: "se****@upi",
    isVerified: true,
  },
  addresses: [
    {
      line1: "12 Market Road",
      line2: "Near bus stand",
      city: "Salem",
      state: "Tamil Nadu",
      pincode: "636001",
      country: "India",
      countryCode: "IN",
    },
  ],
};

describe("mobile seller profile save payload", () => {
  it("hydrates form fields from nested API profile media", () => {
    const fields = sellerProfileToFormFields(savedProfile);

    expect(fields.logoUrl).toBe("1handindia/sellers/user_1/profile/logo/logo.jpg");
    expect(fields.bannerUrl).toBe("1handindia/sellers/user_1/profile/banner/banner.jpg");
    expect(fields.description).toBe("Existing description");
    expect(hasSellerProfileUnsavedChanges(savedProfile, fields, 0)).toBe(false);
  });

  it("updates a newly uploaded banner without clearing the saved logo or touching payout data", () => {
    const fields = sellerProfileToFormFields(savedProfile);
    fields.bannerUrl = "1handindia/sellers/user_1/profile/banner/new-banner.jpg";

    expect(buildSellerProfilePatchPayload(savedProfile, fields, [])).toEqual({
      bannerUrl: "1handindia/sellers/user_1/profile/banner/new-banner.jpg",
    });
  });

  it("updates a newly uploaded logo without clearing the saved banner", () => {
    const fields = sellerProfileToFormFields(savedProfile);
    fields.logoUrl = "1handindia/sellers/user_1/profile/logo/new-logo.jpg";

    expect(buildSellerProfilePatchPayload(savedProfile, fields, [])).toEqual({
      logoUrl: "1handindia/sellers/user_1/profile/logo/new-logo.jpg",
    });
  });

  it("only sends changed payout fields so existing verified payout is not reset by unrelated saves", () => {
    const fields = sellerProfileToFormFields(savedProfile);
    fields.bankName = "ICICI Bank";
    fields.accountNumber = "50100123456789";

    expect(buildSellerProfilePatchPayload(savedProfile, fields, [])).toEqual({
      payoutProfile: {
        bankName: "ICICI Bank",
        accountNumber: "50100123456789",
      },
    });
  });

  it("keeps backward compatibility with legacy top-level media aliases", () => {
    const fields = sellerProfileToFormFields({
      id: "seller_legacy",
      storeName: "Legacy Store",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      logoUrl: "legacy-logo.jpg",
      bannerUrl: "legacy-banner.jpg",
      description: "Legacy description",
    });

    expect(fields.logoUrl).toBe("legacy-logo.jpg");
    expect(fields.bannerUrl).toBe("legacy-banner.jpg");
    expect(fields.description).toBe("Legacy description");
  });
});
