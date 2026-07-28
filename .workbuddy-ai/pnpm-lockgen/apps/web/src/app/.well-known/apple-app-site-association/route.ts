import { NextResponse } from "next/server";

const iosAppId = process.env.INDIHUB_IOS_APP_ID?.trim() ?? "";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: iosAppId
          ? [
              {
                appID: iosAppId,
                paths: ["/stores/*", "/store/*"],
              },
            ]
          : [],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
