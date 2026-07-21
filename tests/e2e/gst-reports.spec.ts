import { expect, test } from "@playwright/test";

const runGstE2e = process.env.GST_E2E_RUN === "true";
const sellerStorageState = process.env.GST_E2E_SELLER_STORAGE_STATE;
const sellerBearerToken = process.env.GST_E2E_SELLER_BEARER_TOKEN;
const foreignDocumentId = process.env.GST_E2E_FOREIGN_DOCUMENT_ID;
const expectedRecipientAddress = process.env.GST_E2E_RECIPIENT_ADDRESS;
const adminEmail = process.env.GST_E2E_ADMIN_EMAIL;
const adminPassword = process.env.GST_E2E_ADMIN_PASSWORD;
const apiUrl = process.env.GST_E2E_API_URL ?? "http://localhost:4000";

test.skip(!runGstE2e, "Set GST_E2E_RUN=true with disposable GST test data.");

test.describe("seller GST reports", () => {
  test("paginates, shows immutable recipient details, downloads PDF, and rejects cross-seller access", async ({
    browser,
    request,
  }) => {
    test.skip(!sellerStorageState, "GST_E2E_SELLER_STORAGE_STATE is required.");
    test.skip(!sellerBearerToken, "GST_E2E_SELLER_BEARER_TOKEN is required.");
    test.skip(!foreignDocumentId, "GST_E2E_FOREIGN_DOCUMENT_ID is required.");

    const context = await browser.newContext({
      storageState: sellerStorageState,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await page.goto("/seller/reports/tax");

    await expect(page.getByRole("heading", { name: "GST reporting" })).toBeVisible();
    await expect(page.getByTestId("seller-gst-register")).toBeVisible();

    const viewButton = page.getByRole("button", { name: /^View .* details$/ }).first();
    await viewButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Recipient", { exact: true })).toBeVisible();
    if (expectedRecipientAddress) {
      await expect(page.getByText(expectedRecipientAddress, { exact: false })).toBeVisible();
    }

    const drawerDownload = page.getByRole("button", { name: "Download PDF" });
    const downloadPromise = page.waitForEvent("download");
    await drawerDownload.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    await page.getByRole("button", { name: "Close" }).click();
    const nextButton = page.getByRole("button", { name: "Next" }).first();
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await expect(page.getByText(/Page 2 \//)).toBeVisible();

    const foreignResponse = await request.get(
      `${apiUrl}/api/seller/reports/gst-documents/${encodeURIComponent(foreignDocumentId!)}/download`,
      {
        headers: { authorization: `Bearer ${sellerBearerToken}` },
      },
    );
    expect(foreignResponse.status()).toBe(404);

    await context.close();
  });

  test("keeps the GST workspace within the mobile viewport", async ({ browser }, testInfo) => {
    test.skip(!sellerStorageState, "GST_E2E_SELLER_STORAGE_STATE is required.");
    test.skip(testInfo.project.name !== "gst-mobile", "Mobile project only.");

    const context = await browser.newContext({ storageState: sellerStorageState });
    const page = await context.newPage();
    await page.goto("/seller/reports/tax");
    await expect(page.getByTestId("seller-gst-register")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await context.close();
  });
});

test.describe("admin GST reports", () => {
  test("filters, opens recipient details, and downloads an issued PDF", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "GST admin credentials are required.");
    await page.goto("/admin/finance/gst-reports");

    const emailInput = page.getByLabel("Admin email");
    if (await emailInput.isVisible()) {
      await emailInput.fill(adminEmail!);
      await page.getByLabel("Password").fill(adminPassword!);
      await page.getByRole("button", { name: "Sign in" }).click();
    }

    await expect(page.getByRole("heading", { name: "GST reports" })).toBeVisible();
    await expect(page.getByTestId("admin-gst-register")).toBeVisible();

    const search = page.getByPlaceholder("Number, order, seller, buyer, GSTIN");
    await search.fill(process.env.GST_E2E_DOCUMENT_SEARCH ?? "");

    await page.getByRole("button", { name: /^View .* details$/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Recipient", { exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});
