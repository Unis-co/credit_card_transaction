import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, newPassword, token } = await req.json();

    const resp = await fetch("https://api-relay.jason-lu.workers.dev/relay/webhook/login-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: newPassword,
        action: "reset",
        token,
      }),
    });

    const result = await resp.json();

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Reset failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Password reset successful",
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Reset API error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
