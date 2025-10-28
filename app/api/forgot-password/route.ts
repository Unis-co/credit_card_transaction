import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { email, newPassword } = await req.json()

    const resp = await fetch("https://ailinker.item.com/webhook/login-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        action: "reset"
      }),
    })

    const result = await resp.json()

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message || "Reset failed" }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    console.error("Reset API error:", error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
