import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = await request.text();

  if (body.trim()) {
    console.warn(
      JSON.stringify({
        event: "csp_report_received",
        contentType,
        body: body.slice(0, 8_000),
      }),
    );
  }

  return new NextResponse(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ status: "ready" });
}
