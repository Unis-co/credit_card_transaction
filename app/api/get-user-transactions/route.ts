// app/api/get-user-transactions/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
  }

  try {
    const resp = await fetch(`https://api-relay.jason-lu.workers.dev/relay/webhook/get-user-transactions?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    return NextResponse.json(data, { status: resp.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Proxy error" },
      { status: 500 }
    );
  }
}
