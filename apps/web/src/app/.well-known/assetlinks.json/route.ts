import { NextResponse } from "next/server";

const androidPackageName = process.env.INDIHUB_ANDROID_APP_PACKAGE ?? "com.onehandindia.customer";
const androidFingerprints = (process.env.INDIHUB_ANDROID_APP_LINK_SHA256 ?? "")
  .split(",")
  .map((fingerprint) => fingerprint.trim())
  .filter(Boolean);

export const dynamic = "force-dynamic";

export function GET() {
  const body = androidFingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: androidPackageName,
            sha256_cert_fingerprints: androidFingerprints,
          },
        },
      ]
    : [];

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
