// app/api/locations/route.ts
import { NextResponse } from "next/server";

// Optional: revalidate every 10 minutes
// export const revalidate = 600;

export async function GET() {
  try {
    // Pick the correct upstream. You’ve used both domains in your code;
    // keep ONE here. If your n8n lives at ailinker.item.com, use that:
    const upstream = "https://api-relay.jason-lu.workers.dev/relay/webhook/bnp-location";
    // If it actually lives at n8n.unisfinance.nl, swap to:
    // const upstream = "https://n8n.unisfinance.nl/webhook/bnp-location";

    const resp = await fetch(upstream, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // server-to-server → no CORS needed
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    // Normalize to a string[] (works for rows or flat arrays)
    let list: string[] = [];
    if (Array.isArray(data)) {
      if (typeof data[0] === "string") {
        list = data as string[];
      } else {
        list = (data as any[]).map(
          r => (r["Location Name"] ?? r["location_name"] ?? r["name"] ?? "").toString()
        );
      }
    }

    // Dedupe + sort
    list = Array.from(new Set(list.filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    return NextResponse.json(list, { status: resp.ok ? resp.status : 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Proxy error" },
      { status: 500 }
    );
  }
}
