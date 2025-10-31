import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "This route is disabled. Excel export is now handled client-side in the Dashboard.",
    },
    { status: 410 }
  );
}
