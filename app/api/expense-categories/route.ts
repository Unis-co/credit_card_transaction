// app/api/expense-categories/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const upstream = "https://api-relay.jason-lu.workers.dev/relay/webhook/bnp-expense-category";

    const resp = await fetch(upstream, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    // Normalize to array of strings
    let categories: string[] = [];
    if (Array.isArray(data)) {
      if (typeof data[0] === "string") {
        categories = data;
      } else {
        categories = (data as any[]).map(
          r =>
            (r["Expense Category"] ?? r["expense_category"] ?? r["name"] ?? "").toString()
        );
      }
    }

    // Dedupe and sort
    categories = Array.from(new Set(categories.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Proxy error" },
      { status: 500 }
    );
  }
}
