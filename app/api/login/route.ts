import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const resp = await fetch("https://api-relay.jason-lu.workers.dev/relay/webhook/login-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        action: "login",
      }),
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, message: text || "Invalid response" };
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (err: any) {
    console.error("Login API proxy error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Proxy error" },
      { status: 500 }
    );
  }
}
